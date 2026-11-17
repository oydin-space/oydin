from datetime import timedelta

from django.core.cache import cache
from django.http import HttpResponse
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from accounts.access import OWNER, require_role
from accounts.http import ApiError, api_view, error, json_response, parse_json
from finance.validation import parse_date

from . import pdf
from . import services as svc
from .models import Partner, PartnerLeadState, PartnerStaff, ShareLink

PUBLIC_LIMIT = 60  # запросов в минуту с одного IP на публичные ссылки
NO_INDEX = {"X-Robots-Tag": "noindex, nofollow", "Cache-Control": "no-store"}


def not_found():
    return error(404, "not_found")


def client_ip(request):
    return request.META.get("REMOTE_ADDR", "")


def throttled(request, scope):
    key = f"sharing:rl:{scope}:{client_ip(request)}:{int(timezone.now().timestamp() // 60)}"
    cache.add(key, 0, 90)
    try:
        return cache.incr(key) > PUBLIC_LIMIT
    except ValueError:
        return False


def own_link(request, id):
    link = ShareLink.objects.filter(business=request.business, pk=id).first()
    if link is None:
        raise ApiError(404, "not_found")
    return link


def parse_expiry(value, link_created=None):
    if not isinstance(value, str) or (expires := parse_datetime(value)) is None:
        raise ApiError(400, "expires_at: дата и время в формате ISO 8601")
    if timezone.is_naive(expires):
        expires = timezone.make_aware(expires)
    base = link_created or timezone.now()
    if expires <= timezone.now():
        raise ApiError(400, "expires_at должен быть в будущем")
    if expires > base + timedelta(days=svc.share_days_max()):
        raise ApiError(400, f"Ссылка живёт не дольше {svc.share_days_max()} дней")
    return expires


def link_fields(body, current=None):
    fields = {}
    if "label" in body:
        label = body["label"]
        if not isinstance(label, str) or len(label) > 120:
            raise ApiError(400, "label: строка до 120 символов")
        fields["label"] = label.strip()
    for key in ("period_from", "period_to"):
        if key in body:
            fields[key] = parse_date(body[key])
    start = fields.get("period_from", current.period_from if current else None)
    end = fields.get("period_to", current.period_to if current else None)
    if start and end and start > end:
        raise ApiError(400, "period_from не может быть позже period_to")
    if "expires_at" in body:
        fields["expires_at"] = parse_expiry(body["expires_at"], current.created_at if current else None)
    return fields


@api_view("GET", "POST")
@require_role(OWNER)
def share_links(request):
    if request.method == "GET":
        links = ShareLink.objects.filter(business=request.business)
        return json_response({"items": [svc.serialize_link(link) for link in links]})
    body = parse_json(request, required=False)
    fields = link_fields(body)
    if ("period_from" in fields) != ("period_to" in fields):
        raise ApiError(400, "Укажите period_from и period_to вместе")
    link, token = svc.create_link(request.business, request.user, **fields)
    return json_response(svc.serialize_link(link, token), status=201)


@api_view("GET", "PATCH", "DELETE")
@require_role(OWNER)
def share_link_detail(request, id):
    link = own_link(request, id)
    if request.method == "PATCH":
        for key, value in link_fields(parse_json(request), link).items():
            setattr(link, key, value)
        link.save()
    elif request.method == "DELETE":
        if link.revoked_at is None:
            link.revoked_at = timezone.now()
            link.save(update_fields=["revoked_at"])
        return HttpResponse(status=204)
    return json_response(svc.serialize_link(link))


def resolve_shared(request, token):
    """(link, None) или (None, ответ-ошибка). Неизвестный токен → 404, истёкший/отозванный → 410."""
    if throttled(request, "shared"):
        return None, error(429, "rate_limited")
    link = svc.find_link(token)
    if link is None:
        return None, not_found()
    state = svc.link_state(link)
    if state != "ok":
        return None, error(410, state)
    return link, None


@api_view("GET", auth=False)
def shared_report(request, token):
    link, failure = resolve_shared(request, token)
    if failure:
        return failure
    svc.record_view(link)
    response = json_response(svc.shared_report(link))
    for k, v in NO_INDEX.items():
        response[k] = v
    return response


@api_view("GET", auth=False)
def shared_pdf(request, token):
    link, failure = resolve_shared(request, token)
    if failure:
        return failure
    svc.record_view(link)
    response = HttpResponse(pdf.render(svc.shared_report(link)), content_type="application/pdf")
    response["Content-Disposition"] = f'attachment; filename="oydin-report-{link.period_from}-{link.period_to}.pdf"'
    for k, v in NO_INDEX.items():
        response[k] = v
    return response


# ───────────── consents ─────────────


@api_view("GET", "POST")
@require_role(OWNER)
def consents(request):
    business = request.business
    if request.method == "POST":
        body = parse_json(request)
        partner_id = body.get("partner_id")
        if isinstance(partner_id, bool) or not isinstance(partner_id, int):
            raise ApiError(400, "partner_id: целое число")
        partner = Partner.objects.filter(pk=partner_id).first()
        if partner is None:
            raise ApiError(404, "not_found")
        return json_response(svc.serialize_consent(partner, svc.grant(business, partner, request.user)))
    latest = svc.latest_consents(business)
    return json_response({"items": [svc.serialize_consent(p, latest.get(p.id)) for p in Partner.objects.all()]})


@api_view("DELETE")
@require_role(OWNER)
def consent_revoke(request, partner_id):
    partner = Partner.objects.filter(pk=partner_id).first()
    if partner is None:
        raise ApiError(404, "not_found")
    return json_response(svc.serialize_consent(partner, svc.revoke(request.business, partner)))


# ───────────── partner cabinet ─────────────


def staff_of(request):
    staff = PartnerStaff.objects.select_related("partner", "user").filter(user=request.user).first()
    if staff is None:
        raise ApiError(403, "not_partner")
    return staff


@api_view("GET", business=False)
def partner_me(request):
    staff = staff_of(request)
    user = request.user
    return json_response({
        "partner": svc.serialize_partner(staff.partner),
        "name": user.get_full_name() or user.get_username(),
        "email": user.email,
    })


@api_view("GET", business=False)
def partner_leads(request):
    partner = staff_of(request).partner
    status, segment = request.GET.get("status"), request.GET.get("segment")
    if status and status not in PartnerLeadState.Status.values:
        raise ApiError(400, "status: new, contacted или closed")
    items = [lead for _, lead in svc.partner_leads(partner)]
    if status:
        items = [i for i in items if i["status"] == status]
    if segment:
        items = [i for i in items if i["segment"] == segment]
    return json_response({"items": items})


@api_view("PATCH", business=False)
def partner_lead_detail(request, id):
    partner = staff_of(request).partner
    status = parse_json(request).get("status")
    if status not in PartnerLeadState.Status.values:
        raise ApiError(400, "status: new, contacted или closed")
    consent = svc.find_lead(partner, id)
    if consent is None:
        raise ApiError(404, "not_found")
    return json_response(svc.set_lead_status(partner, consent, status))


@api_view("GET", auth=False)
def impact(request):
    return json_response(svc.impact())
