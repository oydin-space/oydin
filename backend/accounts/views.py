from django.conf import settings
from django.contrib.auth import login, logout
from django.http import HttpResponse
from django.views.decorators.csrf import csrf_exempt, ensure_csrf_cookie

from .http import ApiError, api_view, json_response, parse_json
from .models import Business
from .services import demo_user, serialize_business, serialize_user, user_for_telegram
from .telegram import InvalidInitData, validate_init_data

TAX_REGIMES = {value for value, _ in Business.TaxRegime.choices}


@api_view("GET", auth=False)
@ensure_csrf_cookie
def csrf(request):
    return json_response({"ok": True})


@csrf_exempt
@api_view("POST", auth=False)
def demo(request):
    if not settings.DEMO_LOGIN:
        raise ApiError(403, "Демо-вход выключен")
    user = demo_user()
    login(request, user)
    return json_response(serialize_user(user))


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
    user = user_for_telegram(tg_user)
    login(request, user, backend="django.contrib.auth.backends.ModelBackend")
    return json_response(serialize_user(user))


@api_view("POST", auth=False)
def logout_view(request):
    logout(request)
    return HttpResponse(status=204)


@api_view("GET")
def me(request):
    return json_response(serialize_user(request.user))


@api_view("PATCH")
def business(request):
    body = parse_json(request)
    regime = body.get("tax_regime")
    if regime is not None:
        if regime not in TAX_REGIMES:
            raise ApiError(400, "Неизвестный налоговый режим")
        request.business.tax_regime = regime
        request.business.save(update_fields=["tax_regime"])
    return json_response(serialize_business(request.business))
