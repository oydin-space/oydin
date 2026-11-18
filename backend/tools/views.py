import math

from django.db import transaction

from accounts.access import FINANCE_READERS, require_role
from accounts.models import Business
from accounts.http import ApiError, api_view, json_response, parse_json
from ai import ui
from planning.texts import resolve_lang

from . import builtins
from .models import SavedTool

MAX_TITLE = 120
MAX_VALUES = 60
MAX_TOOLS = 50


def serialize(t, lang, specs):
    title, spec = builtins.localize(t.title, t.kind, t.spec, lang, specs.get(t.kind, ""))
    return {
        "id": t.id, "title": title, "kind": t.kind, "spec": spec, "pinned": t.pinned, "values": t.values,
        "created_at": t.created_at.isoformat(), "updated_at": t.updated_at.isoformat(),
    }


def template_specs(kinds, lang):
    """{kind: структура и тексты шаблона на языке lang, без данных бизнеса} для встроенных видов среди kinds."""
    return {kind: builtins.build(kind, None, lang)["spec"] for kind in set(kinds) & set(builtins.KINDS)}


def clean_title(value):
    if not isinstance(value, str) or not value.strip() or len(value.strip()) > MAX_TITLE:
        raise ApiError(400, "invalid_title")
    return value.strip()


def clean_kind(value):
    if value not in builtins.ALL_KINDS:
        raise ApiError(400, "unsupported_kind")
    return value


def clean_spec(value):
    if not isinstance(value, str) or len(value.encode()) > ui.MAX_SIZE:
        raise ApiError(400, "invalid_spec")
    spec = ui.validate_tool(value)
    if spec is None:
        raise ApiError(400, "invalid_spec")
    return spec


def clean_values(value, spec):
    if not isinstance(value, dict) or len(value) > MAX_VALUES:
        raise ApiError(400, "invalid_values")
    names = ui.input_names(spec)
    for k, v in value.items():
        if k not in names or isinstance(v, bool) or not isinstance(v, (int, float)) or not math.isfinite(v):
            raise ApiError(400, "invalid_values")
    return value


@api_view("GET", "POST")
@require_role(*FINANCE_READERS)
def tools(request):
    if request.method == "GET":
        lang = resolve_lang(request)
        items = list(SavedTool.objects.filter(business=request.business))
        specs = template_specs([t.kind for t in items], lang)
        return json_response([serialize(t, lang, specs) for t in items])
    body = parse_json(request)
    spec = clean_spec(body.get("spec"))
    title, kind = clean_title(body.get("title")), clean_kind(body.get("kind", "custom"))
    values = clean_values(body.get("values", {}), spec)
    with transaction.atomic():
        Business.objects.select_for_update().get(pk=request.business.pk)
        if SavedTool.objects.filter(business=request.business).count() >= MAX_TOOLS:
            raise ApiError(409, "tools_limit")
        tool = SavedTool.objects.create(
            business=request.business, created_by=request.user, title=title, kind=kind, spec=spec,
            pinned=bool(body.get("pinned", False)), values=values,
        )
    return json_response(serialize(tool, resolve_lang(request), template_specs([tool.kind], resolve_lang(request))), status=201)


@api_view("GET", "PATCH", "DELETE")
@require_role(*FINANCE_READERS)
def tool_detail(request, id):
    tool = SavedTool.objects.filter(pk=id, business=request.business).first()
    if tool is None:
        raise ApiError(404, "not_found")
    lang = resolve_lang(request)
    if request.method == "GET":
        return json_response(serialize(tool, lang, template_specs([tool.kind], lang)))
    if request.method == "DELETE":
        tool.delete()
        return json_response({"ok": True})
    body = parse_json(request)
    if "title" in body:
        tool.title = clean_title(body["title"])
    if "spec" in body:
        tool.spec = clean_spec(body["spec"])
        tool.values = {k: v for k, v in tool.values.items() if k in ui.input_names(tool.spec)}
    if "pinned" in body:
        if not isinstance(body["pinned"], bool):
            raise ApiError(400, "invalid_pinned")
        tool.pinned = body["pinned"]
    if "values" in body:
        tool.values = clean_values(body["values"], tool.spec)
    tool.save()
    return json_response(serialize(tool, lang, template_specs([tool.kind], lang)))


@api_view("GET")
@require_role(*FINANCE_READERS)
def templates(request):
    lang = request.GET.get("lang") if request.GET.get("lang") in builtins.LANGS else "ru"
    return json_response([builtins.build(kind, request.business, lang) for kind in builtins.KINDS])
