import json

from django.db import transaction
from django.utils import timezone

from accounts.access import OWNER, require_role
from accounts.http import ApiError, api_view, json_response, parse_json
from accounts.models import Business
from ai.views import throttle
from publicapi import ssrf

from . import didox, mcp_client, rest_client, vault
from .models import Connector, DidoxAccount

MAX_CONNECTORS = 20
MAX_SCHEMA = 8000
TEST_PER_MINUTE = 6
FORBIDDEN_HEADERS = {"host", "content-length", "transfer-encoding", "connection", "upgrade", "te", "trailer", "keep-alive"}


def forbid_demo(request):
    if request.business.is_demo:
        raise ApiError(403, "forbidden")


def serialize(c):
    return {
        "id": c.id, "kind": c.kind, "name": c.name, "description": c.description, "url": c.url, "method": c.method,
        "params_schema": c.params_schema, "auth_header": c.auth_header, "has_secret": bool(c.auth_secret_enc),
        "tools": [{"name": t["name"], "description": t.get("description", "")} for t in c.tools_cache],
        "enabled": c.enabled, "last_test_ok": c.last_test_ok, "last_test_error": c.last_test_error,
        "last_test_at": c.last_test_at.isoformat() if c.last_test_at else None, "created_at": c.created_at.isoformat(),
    }


def text(body, key, *, max_len, required=False):
    value = body.get(key, "")
    if not isinstance(value, str) or len(value.strip()) > max_len or (required and not value.strip()):
        raise ApiError(400, f"invalid_{key}")
    return value.strip()


def clean_url(value, kind):
    if not isinstance(value, str) or not value.strip() or len(value) > 500:
        raise ApiError(400, "invalid_url")
    value = value.strip()
    probe = rest_client.PLACEHOLDER.sub("x", value) if kind == Connector.Kind.REST else value
    try:
        ssrf.check_url(probe, default_port_only=True)
    except ssrf.UnsafeUrl as exc:
        raise ApiError(400, str(exc)) from None
    return value


def clean_schema(value, url):
    if value in (None, {}):
        value = {"type": "object", "properties": {}}
    if not isinstance(value, dict) or value.get("type") != "object" or len(json.dumps(value)) > MAX_SCHEMA:
        raise ApiError(400, "invalid_params_schema")
    props = value.get("properties", {})
    if not isinstance(props, dict) or any(n not in props for n in rest_client.placeholders(url)):
        raise ApiError(400, "invalid_params_schema")
    return value


def clean_header(body):
    header = text(body, "auth_header", max_len=60)
    if header and not all(ch.isalnum() or ch in "-_" for ch in header):
        raise ApiError(400, "invalid_auth_header")
    if header.lower() in FORBIDDEN_HEADERS or header.lower().startswith("proxy-"):
        raise ApiError(400, "invalid_header")
    return header


def own(request, id):
    c = Connector.objects.filter(id=id, business=request.business).first()
    if c is None:
        raise ApiError(404, "not_found")
    return c


def apply(c, body, *, creating):
    if creating:
        kind = body.get("kind")
        if kind not in Connector.Kind.values:
            raise ApiError(400, "invalid_kind")
        c.kind = kind
    if creating or "name" in body:
        c.name = text(body, "name", max_len=60, required=True)
    if creating or "description" in body:
        c.description = text(body, "description", max_len=500, required=c.kind == Connector.Kind.REST)
    if creating or "url" in body:
        c.url = clean_url(body.get("url"), c.kind)
    if c.kind == Connector.Kind.REST:
        if creating or "method" in body:
            method = str(body.get("method", "")).upper()
            if method not in rest_client.METHODS:
                raise ApiError(400, "invalid_method")
            c.method = method
        if creating or "params_schema" in body or "url" in body:
            c.params_schema = clean_schema(body.get("params_schema", c.params_schema), c.url)
    if creating or "auth_header" in body:
        c.auth_header = clean_header(body)
    if "auth_secret" in body:
        secret = body["auth_secret"]
        if not isinstance(secret, str) or len(secret) > 2000:
            raise ApiError(400, "invalid_auth_secret")
        try:
            c.auth_secret_enc = vault.encrypt(secret, vault.context(c, "auth_secret_enc"))  # "" снимает секрет
        except vault.VaultError:
            raise ApiError(503, "vault_unavailable") from None
    if "enabled" in body:
        if not isinstance(body["enabled"], bool):
            raise ApiError(400, "invalid_enabled")
        c.enabled = body["enabled"]


@api_view("GET", "POST")
@require_role(OWNER)
def connectors(request):
    if request.method == "GET":
        return json_response([serialize(c) for c in Connector.objects.filter(business=request.business)])
    forbid_demo(request)
    body = parse_json(request)
    c = Connector(business=request.business, created_by=request.user)
    apply(c, body, creating=True)
    with transaction.atomic():
        Business.objects.select_for_update().get(pk=request.business.pk)
        if Connector.objects.filter(business=request.business).count() >= MAX_CONNECTORS:
            raise ApiError(409, "connectors_limit")
        c.save()
    return json_response(serialize(c), 201)


@api_view("GET", "PATCH", "DELETE")
@require_role(OWNER)
def connector_detail(request, id):
    if request.method != "GET":
        forbid_demo(request)
    c = own(request, id)
    if request.method == "DELETE":
        c.delete()
        return json_response({"ok": True})
    if request.method == "PATCH":
        old_url = c.url
        apply(c, parse_json(request), creating=False)
        if c.url != old_url:
            c.tools_cache = []
        c.save()
    return json_response(serialize(c))


@api_view("POST")
@require_role(OWNER)
def connector_test(request, id):
    """MCP: подключается и обновляет список инструментов. REST: вызывает обработчик с переданными args."""
    forbid_demo(request)
    throttle(request.user, "connector_test", TEST_PER_MINUTE)
    c = own(request, id)
    body = parse_json(request, required=False)
    result = None
    try:
        if c.kind == Connector.Kind.MCP:
            c.tools_cache = mcp_client.list_tools(c)
        else:
            args = body.get("args", {})
            if not isinstance(args, dict):
                raise ApiError(400, "invalid_args")
            result = rest_client.call(c, args)
        c.last_test_ok, c.last_test_error = True, ""
    except rest_client.CallError as exc:
        c.last_test_ok, c.last_test_error = False, str(exc)[:60]
    c.last_test_at = timezone.now()
    c.save(update_fields=["tools_cache", "last_test_ok", "last_test_error", "last_test_at"])
    return json_response({"ok": c.last_test_ok, "error": c.last_test_error, "result": result, "connector": serialize(c)})


SYNC_PER_MINUTE = 2


def serialize_didox(a):
    if a is None:
        return {"connected": False, "configured": bool(didox.setting("DIDOX_PARTNER_TOKEN"))}
    return {
        "connected": True, "configured": bool(didox.setting("DIDOX_PARTNER_TOKEN")), "tax_id": didox.mask(a.tax_id),
        "name": a.name, "last_sync_at": a.last_sync_at.isoformat() if a.last_sync_at else None, "last_error": a.last_error,
    }


@api_view("GET", "PUT", "DELETE")
@require_role(OWNER)
def didox_account(request):
    """Подключение Didox: PUT проверяет вход (ИНН/ПИНФЛ + пароль) и сохраняет пароль зашифрованным."""
    account = DidoxAccount.objects.filter(business=request.business).first()
    if request.method == "GET":
        return json_response(serialize_didox(account))
    forbid_demo(request)
    if request.method == "DELETE":
        if account:
            account.delete()
        return json_response(serialize_didox(None))
    throttle(request.user, "didox_login", SYNC_PER_MINUTE)
    body = parse_json(request)
    tax_id = str(body.get("tax_id", "")).strip()
    password = body.get("password", "")
    if not (tax_id.isdigit() and len(tax_id) in (9, 14)):
        raise ApiError(400, "invalid_tax_id")
    if not isinstance(password, str) or not password or len(password) > 200:
        raise ApiError(400, "invalid_password")
    try:
        _, name = didox.login(tax_id, password)
    except didox.DidoxError as exc:
        raise ApiError(503 if str(exc) in ("not_configured", "unavailable") else 400, f"didox_{exc}") from None
    try:
        password_enc = vault.encrypt(password, vault.context(DidoxAccount(business=request.business), "password_enc"))
    except vault.VaultError:
        raise ApiError(503, "vault_unavailable") from None
    account, _ = DidoxAccount.objects.update_or_create(
        business=request.business,
        defaults={"tax_id": tax_id, "password_enc": password_enc, "name": name[:300], "last_error": ""},
    )
    return json_response(serialize_didox(account))


@api_view("POST")
@require_role(OWNER)
def didox_sync(request):
    """Импорт подписанных счетов-фактур в черновики операций."""
    forbid_demo(request)
    throttle(request.user, "didox_sync", SYNC_PER_MINUTE)
    account = DidoxAccount.objects.filter(business=request.business).first()
    if account is None:
        raise ApiError(404, "not_found")
    try:
        created = didox.sync(account, request.user)
    except didox.DidoxError as exc:
        account.last_error = str(exc)[:40]
        account.save(update_fields=["last_error"])
        return json_response({"ok": False, "error": f"didox_{exc}", "created": 0, "account": serialize_didox(account)})
    return json_response({"ok": True, "error": "", "created": created, "account": serialize_didox(account)})
