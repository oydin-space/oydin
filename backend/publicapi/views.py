from django.http import HttpResponse
from django.utils import timezone

from accounts.access import OWNER, require_role
from accounts.http import ApiError, api_view, json_response, parse_json
from finance import services as fin
from finance.models import Transaction
from finance.validation import parse_date, transaction_fields

from . import idempotency, ssrf
from . import services as hooks
from .auth import SCOPES, bearer_view, hash_token, new_token, TOKEN_PREFIX_LEN
from .models import ApiToken, WebhookEndpoint


# ───────────── токены и вебхуки (сессия, owner; CSRF включён) ─────────────
def serialize_token(t):
    return {
        "id": t.id, "name": t.name, "prefix": t.prefix, "scopes": t.scopes,
        "created_at": t.created_at.isoformat(), "last_used_at": t.last_used_at.isoformat() if t.last_used_at else None,
    }


def serialize_endpoint(e):
    return {
        "id": e.id, "url": e.url, "events": e.events, "active": e.active,
        "created_at": e.created_at.isoformat(), "last_delivery_status": e.last_delivery_status,
    }


@api_view("GET", "POST")
@require_role(OWNER)
def tokens(request):
    business = request.business
    if request.method == "GET":
        qs = ApiToken.objects.filter(business=business, revoked_at__isnull=True)
        return json_response({"items": [serialize_token(t) for t in qs]})
    body = parse_json(request)
    name = body.get("name")
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 80:
        raise ApiError(400, "invalid_name")
    scopes = body.get("scopes", ["read"])
    if not isinstance(scopes, list) or not scopes or any(s not in SCOPES for s in scopes):
        raise ApiError(400, "invalid_scopes")
    raw = new_token()
    token = ApiToken.objects.create(
        business=business, created_by=request.user, name=name.strip(), prefix=raw[:TOKEN_PREFIX_LEN],
        token_hash=hash_token(raw), scopes=sorted(set(scopes)),
    )
    return json_response({**serialize_token(token), "token": raw}, status=201)


@api_view("DELETE")
@require_role(OWNER)
def token_detail(request, id):
    token = ApiToken.objects.filter(business=request.business, pk=id, revoked_at__isnull=True).first()
    if token is None:
        raise ApiError(404, "not_found")
    token.revoked_at = timezone.now()
    token.save(update_fields=["revoked_at"])
    return HttpResponse(status=204)


def parse_events(value):
    if not isinstance(value, list) or not value or any(e not in hooks.EVENTS for e in value):
        raise ApiError(400, "invalid_events")
    return list(dict.fromkeys(value))


@api_view("GET", "POST")
@require_role(OWNER)
def webhooks(request):
    business = request.business
    if request.method == "GET":
        return json_response({"items": [serialize_endpoint(e) for e in WebhookEndpoint.objects.filter(business=business)]})
    body = parse_json(request)
    url = body.get("url")
    if not isinstance(url, str) or len(url) > 500:
        raise ApiError(400, "invalid_url")
    try:
        ssrf.check_url(url)
    except ssrf.UnsafeUrl as exc:
        raise ApiError(400, str(exc)) from None
    endpoint = WebhookEndpoint.objects.create(
        business=business, url=url, events=parse_events(body.get("events")), secret=hooks.new_secret()
    )
    return json_response({**serialize_endpoint(endpoint), "secret": endpoint.secret}, status=201)


def own_endpoint(request, id):
    endpoint = WebhookEndpoint.objects.filter(business=request.business, pk=id).first()
    if endpoint is None:
        raise ApiError(404, "not_found")
    return endpoint


@api_view("PATCH", "DELETE")
@require_role(OWNER)
def webhook_detail(request, id):
    endpoint = own_endpoint(request, id)
    if request.method == "DELETE":
        endpoint.delete()
        return HttpResponse(status=204)
    body = parse_json(request)
    if "active" in body:
        if not isinstance(body["active"], bool):
            raise ApiError(400, "invalid_active")
        endpoint.active = body["active"]
    if "events" in body:
        endpoint.events = parse_events(body["events"])
    endpoint.save()
    return json_response(serialize_endpoint(endpoint))


@api_view("POST")
@require_role(OWNER)
def webhook_ping(request, id):
    return json_response({"status": hooks.ping(own_endpoint(request, id))})


# ───────────── публичный API /v1 (Bearer) ─────────────
@bearer_view("GET")
def v1_business(request):
    b = request.business
    return json_response({
        "id": b.id, "name": b.name, "industry": b.industry, "city": b.city,
        "locale": getattr(b, "locale", "ru"), "segment": getattr(b, "segment", "retail"),
        "plan": getattr(b, "plan", "free"), "is_demo": b.is_demo,
    })


@bearer_view("GET")
def v1_accounts(request):
    return json_response({"items": fin.list_accounts(request.business)})


@bearer_view("GET")
def v1_pulse(request):
    return json_response(fin.pulse(request.business))


@bearer_view("GET")
def v1_forecast(request):
    days = _int(request.GET.get("days"), 30, 90)
    return json_response({"points": fin.forecast_points(request.business, days)})


def _int(raw, default, maximum):
    if raw is None:
        return default
    try:
        return max(1, min(int(raw), maximum))
    except ValueError:
        raise ApiError(400, "invalid_number") from None


@bearer_view("GET", "POST")
def v1_transactions(request):
    if request.method == "POST":
        return v1_transaction_create(request)
    qs = Transaction.objects.filter(business=request.business).order_by("-id")
    if request.GET.get("from"):
        qs = qs.filter(date__gte=parse_date(request.GET["from"]))
    if request.GET.get("to"):
        qs = qs.filter(date__lte=parse_date(request.GET["to"]))
    cursor = request.GET.get("cursor")
    if cursor:
        if not cursor.isdigit():
            raise ApiError(400, "invalid_cursor")
        qs = qs.filter(id__lt=int(cursor))
    limit = _int(request.GET.get("limit"), 100, 500)
    rows = list(qs[: limit + 1])
    page = rows[:limit]
    return json_response({
        "items": [fin.serialize_transaction(t) for t in page],
        "next_cursor": str(page[-1].id) if len(rows) > limit else None,
    })


def v1_transaction_create(request):
    token = request.api_token
    if "write" not in token.scopes:
        raise ApiError(403, "forbidden")
    business = request.business

    def create():
        body = parse_json(request)
        status = body.get("status", Transaction.Status.DRAFT)
        # Токен с write может подтверждать; по умолчанию запись из API — черновик на проверку.
        if status not in {s for s, _ in Transaction.Status.choices}:
            raise ApiError(400, "invalid_status")
        fields = transaction_fields(body, business, partial=False)
        fields.setdefault("date", timezone.localdate())
        tx = Transaction.objects.create(
            business=business, status=status, source="api", created_by=token.created_by, **fields
        )
        tx = fin.merge_transfer(tx)
        hooks.emit("transaction.created", tx)
        return json_response(fin.serialize_transaction(tx), status=201)

    return idempotency.run(request, business, "v1_tx", create)
