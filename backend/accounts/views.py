from urllib.parse import urlencode

from django.conf import settings
from django.db import transaction
from django.contrib.auth import login, logout
from django.http import HttpResponse, HttpResponseRedirect
from django.shortcuts import get_object_or_404
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie

from . import google, otp
from .access import OWNER, get_profile
from .http import ApiError, api_view, error, json_response, parse_json
from .models import Business, Membership
from .services import (
    claim_invites,
    create_business,
    DEMO_USERNAME,
    demo_user,
    serialize_business,
    serialize_business_item,
    serialize_user,
    user_for_email,
    user_for_google,
    user_for_telegram,
)
from .telegram import InvalidInitData, validate_init_data, validate_widget

SEGMENTS = {value for value, _ in Business.Segment.choices}
TAX_REGIMES = {value for value, _ in Business.TaxRegime.choices}
ROLES = {value for value, _ in Membership.Role.choices}
BACKEND = "django.contrib.auth.backends.ModelBackend"
SESSION_KEY = "google_oauth"
LANGS = {"ru", "uz", "en"}


def _login(request, user):
    if user.is_staff or user.is_superuser:
        raise ApiError(403, "forbidden")
    claim_invites(user)
    login(request, user, backend=BACKEND)
    return json_response(serialize_user(user))


@api_view("GET", auth=False)
@ensure_csrf_cookie
def csrf(request):
    return json_response({"ok": True})


@api_view("GET", auth=False)
def providers(request):
    return json_response({
        "email": bool(settings.EMAIL_CONFIGURED),
        "google": google.is_configured(),
        "telegram": bool(settings.TELEGRAM_BOT_TOKEN),
        "demo": bool(settings.DEMO_LOGIN),
    })


@csrf_exempt
@api_view("POST", auth=False)
def demo(request):
    if not settings.DEMO_LOGIN:
        raise ApiError(403, "Демо-вход выключен")
    if request.content_type != "application/json":
        raise ApiError(415, "unsupported_media_type")
    if request.user.is_authenticated and request.user.username != DEMO_USERNAME:
        raise ApiError(409, "already_authenticated")
    return _login(request, demo_user())


@csrf_exempt
@api_view("POST", auth=False)
def telegram(request):
    body = parse_json(request)
    init_data = body.get("init_data")
    if not isinstance(init_data, str) or not init_data:
        raise ApiError(401, "Нет данных Telegram")
    try:
        tg_user = validate_init_data(init_data, settings.TELEGRAM_BOT_TOKEN)
    except InvalidInitData as exc:
        raise ApiError(401, str(exc)) from None
    return _login(request, user_for_telegram(tg_user))


WIDGET_STATUS = {"not_configured": 503, "invalid_hash": 403, "expired": 400, "invalid": 400}


@csrf_exempt
@api_view("POST", auth=False)
def telegram_widget(request):
    body = parse_json(request)
    try:
        tg_user = validate_widget(body, settings.TELEGRAM_BOT_TOKEN)
    except InvalidInitData as exc:
        code = str(exc)
        raise ApiError(WIDGET_STATUS[code], "telegram_not_configured" if code == "not_configured" else code) from None
    return _login(request, user_for_telegram(tg_user))


def _client_ip(request):
    # За Caddy реальный адрес — последний элемент X-Forwarded-For (его дописывает прокси).
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    return forwarded.split(",")[-1].strip() if forwarded else request.META.get("REMOTE_ADDR", "")


@csrf_exempt
@api_view("POST", auth=False)
def email_request(request):
    body = parse_json(request)
    email = otp.normalize_email(body.get("email"))
    lang = body.get("lang") if body.get("lang") in LANGS else "ru"
    otp.request_code(email, _client_ip(request), lang)
    return json_response({"ok": True, "resend_in": otp.RESEND_SECONDS})


@csrf_exempt
@api_view("POST", auth=False)
def email_verify(request):
    body = parse_json(request)
    email = otp.normalize_email(body.get("email"))
    otp.verify_code(email, body.get("code"), _client_ip(request))
    user = user_for_email(email)
    if user.is_staff or user.is_superuser:
        raise ApiError(403, "forbidden")
    return _login(request, user)


def safe_next(value):
    """Только относительные пути внутри сайта: /app, /app/x. Всё прочее — /app."""
    if isinstance(value, str) and value.startswith("/") and not value.startswith("//") and "\\" not in value:
        return value
    return "/app"


def _auth_error(code):
    return HttpResponseRedirect("/?" + urlencode({"auth_error": code}))


def _redirect_uri(request):
    return request.build_absolute_uri("/api/auth/google/callback/")


@api_view("GET", auth=False)
def google_start(request):
    if not google.is_configured():
        return error(503, "google_not_configured")
    flow = google.new_flow(safe_next(request.GET.get("next")))
    request.session[SESSION_KEY] = flow
    return HttpResponseRedirect(google.authorize_url(flow, _redirect_uri(request)))


@api_view("GET", auth=False)
def google_callback(request):
    if not google.is_configured():
        return error(503, "google_not_configured")
    flow = request.session.pop(SESSION_KEY, None)
    state = request.GET.get("state", "")
    if not flow or not state or state != flow.get("state"):
        return _auth_error("invalid_state")
    if request.GET.get("error") or not request.GET.get("code"):
        return _auth_error("access_denied")
    try:
        id_token = google.exchange_code(request.GET["code"], flow["verifier"], _redirect_uri(request))
        claims = google.verify_id_token(id_token, flow["nonce"])
    except google.GoogleAuthError as exc:
        return _auth_error(exc.code)
    user = user_for_google(claims)
    if user.is_staff or user.is_superuser:
        return _auth_error("forbidden")
    login(request, user, backend=BACKEND)
    return HttpResponseRedirect(safe_next(flow.get("next")))


@api_view("POST", auth=False)
def logout_view(request):
    logout(request)
    return HttpResponse(status=204)


@api_view("GET", business=False)
def me(request):
    claim_invites(request.user)
    return json_response(serialize_user(request.user))


@api_view("PATCH")
def business(request):
    if request.role != OWNER:
        return error(403, "forbidden")
    body = parse_json(request)
    regime = body.get("tax_regime")
    if regime is not None:
        if regime not in TAX_REGIMES:
            raise ApiError(400, "Неизвестный налоговый режим")
        request.business.tax_regime = regime
        request.business.save(update_fields=["tax_regime"])
    return json_response(serialize_business(request.business))


def _text(body, key, required=False, limit=200):
    value = body.get(key, "")
    if not isinstance(value, str):
        raise ApiError(400, f"invalid_{key}")
    value = value.strip()[:limit]
    if required and not value:
        raise ApiError(400, f"{key}_required")
    return value


def _segment(body):
    value = body.get("segment", "")
    if value not in SEGMENTS | {""}:
        raise ApiError(400, "invalid_segment")
    return value


@api_view("GET", "POST", business=False)
def businesses(request):
    if request.method == "POST":
        body = parse_json(request)
        created = create_business(
            request.user, _text(body, "name", required=True), _text(body, "industry"), _text(body, "city"),
            _segment(body),
        )
        membership = Membership.objects.select_related("business").get(user=request.user, business=created)
        return json_response(serialize_business_item(membership), status=201)
    items = Membership.objects.filter(user=request.user).select_related("business")
    return json_response({"items": [serialize_business_item(m) for m in items]})


def _membership_in(request, business_id, owner=False):
    membership = Membership.objects.filter(user=request.user, business_id=business_id).select_related("business").first()
    if membership is None or (owner and membership.role != OWNER):
        raise ApiError(403, "forbidden")
    return membership


@api_view("PATCH", business=False)
def business_detail(request, business_id):
    membership = _membership_in(request, business_id, owner=True)
    if membership.business.is_demo:
        raise ApiError(403, "forbidden")
    body = parse_json(request)
    b = membership.business
    fields = []
    for key in ("name", "industry", "city"):
        if key in body:
            setattr(b, key, _text(body, key, required=key == "name"))
            fields.append(key)
    if "segment" in body:
        b.segment = _segment(body)
        fields.append("segment")
    if fields:
        b.save(update_fields=fields)
    return json_response(serialize_business_item(membership))


@api_view("POST", business=False)
def business_switch(request, business_id):
    membership = _membership_in(request, business_id)
    profile = get_profile(request.user)
    profile.business = membership.business
    profile.save(update_fields=["business"])
    return json_response(serialize_user(request.user))


def serialize_member(m):
    user = m.user
    return {
        "id": m.id,
        "user_id": user.id if user else None,
        "name": (user.first_name or user.email or user.username) if user else "",
        "email": (user.email if user else m.invited_email) or None,
        "role": m.role,
        "pending": user is None,
        "created_at": m.created_at.isoformat(),
    }


@api_view("GET", "POST", business=False)
def members(request, business_id):
    membership = _membership_in(request, business_id, owner=True)
    if request.method == "GET":
        items = Membership.objects.filter(business_id=business_id).select_related("user").order_by("created_at", "id")
        return json_response({"items": [serialize_member(m) for m in items]})
    if membership.business.is_demo:
        raise ApiError(403, "forbidden")
    body = parse_json(request)
    email = otp.normalize_email(body.get("email"))
    role = body.get("role")
    if role not in ROLES:
        raise ApiError(400, "invalid_role")
    # Всегда «ожидающее» приглашение: привязка к пользователю — в claim_invites при его входе; ответ не раскрывает аккаунты.
    if Membership.objects.filter(business_id=business_id, user__isnull=True, invited_email=email).exists():
        raise ApiError(400, "already_member")
    m = Membership.objects.create(business_id=business_id, user=None, role=role, invited_email=email)
    return json_response(serialize_member(m), status=201)


def _is_last_owner(member):
    return member.role == OWNER and not Membership.objects.filter(
        business_id=member.business_id, role=OWNER, user__isnull=False
    ).exclude(pk=member.pk).exists()


@api_view("PATCH", "DELETE", business=False)
@transaction.atomic
def member_detail(request, business_id, member_id):
    membership = _membership_in(request, business_id, owner=True)
    if membership.business.is_demo:
        raise ApiError(403, "forbidden")
    # Сериализуем конкурентные смены/удаления владельцев: блокируем строки владельцев до проверки.
    list(Membership.objects.select_for_update().filter(business_id=business_id, role=OWNER).order_by("id"))
    member = get_object_or_404(Membership.objects.select_related("user"), pk=member_id, business_id=business_id)
    if request.method == "DELETE":
        if _is_last_owner(member):
            raise ApiError(400, "last_owner")
        if member.user_id:
            profile = get_profile(member.user)
            if profile.business_id == member.business_id:
                profile.business = None
                profile.save(update_fields=["business"])
        member.delete()
        return HttpResponse(status=204)
    role = parse_json(request).get("role")
    if role not in ROLES:
        raise ApiError(400, "invalid_role")
    if role != OWNER and _is_last_owner(member):
        raise ApiError(400, "last_owner")
    member.role = role
    member.save(update_fields=["role"])
    return json_response(serialize_member(member))
