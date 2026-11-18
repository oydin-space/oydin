from accounts.access import OWNER, require_role
from accounts.http import ApiError, api_view, json_response, parse_json

from . import services as svc
from .models import WidgetProposal


def _write_guard(request):
    if request.method != "GET" and (request.business.is_demo or request.user.username == "demo"):
        raise ApiError(403, "demo_tenant")


@api_view("GET", "PUT")
@require_role(OWNER)
def modules(request):
    if request.method == "PUT":
        _write_guard(request)
        svc.set_modules(request.business, parse_json(request).get("modules"))
    return json_response(svc.serialize_modules(request.business))


@api_view("POST")
@require_role(OWNER)
def preset(request):
    _write_guard(request)
    svc.apply_preset(request.business, parse_json(request).get("preset"))
    return json_response(svc.serialize_modules(request.business))


@api_view("GET")
@require_role(OWNER)
def widgets(request):
    return json_response({"widgets": svc.active_widgets(request.business)})


@api_view("POST")
@require_role(OWNER)
def usage(request):
    body = parse_json(request)
    svc.record_usage(request.business, body.get("key"), body.get("action"))
    return json_response({"ok": True}, status=201)


@api_view("GET", "POST")
@require_role(OWNER)
def proposals(request):
    if request.method == "POST":
        _write_guard(request)
        made = svc.propose_from_usage(request.business)
        return json_response({"created": [svc.serialize_proposal(p) for p in made]}, status=201)
    rows = WidgetProposal.objects.filter(business=request.business)[:50]
    return json_response({"proposals": [svc.serialize_proposal(p) for p in rows]})


def _decide(request, id, approve):
    _write_guard(request)
    return json_response(svc.serialize_proposal(svc.decide(request.business, id, approve)))


@api_view("POST")
@require_role(OWNER)
def proposal_approve(request, id):
    return _decide(request, id, True)


@api_view("POST")
@require_role(OWNER)
def proposal_reject(request, id):
    return _decide(request, id, False)


@api_view("GET")
@require_role(OWNER)
def versions(request, key):
    return json_response({"versions": svc.versions(request.business, key)})


@api_view("POST")
@require_role(OWNER)
def rollback(request, key):
    _write_guard(request)
    return json_response(svc.serialize_widget(svc.rollback(request.business, key, parse_json(request).get("version"))))
