import hmac
import json
import logging

from django.conf import settings
from django.core.cache import cache
from django.views.decorators.csrf import csrf_exempt

from accounts.access import active_membership
from accounts.services import DEMO_USERNAME
from accounts.http import ApiError, api_view, error, json_response, parse_json

from . import conf, services
from .models import NotificationSettings, TelegramLink

log = logging.getLogger(__name__)
UPDATE_TTL = 24 * 3600
FLAGS = ("daily_brief", "gap_alerts", "weekly_digest", "tax_reminders")


@csrf_exempt
def webhook(request):
    if request.method != "POST":
        return error(405, "Метод не поддерживается")
    given = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if not settings.TELEGRAM_BOT_TOKEN or not hmac.compare_digest(given.encode(), conf.webhook_secret().encode()):
        return error(403, "forbidden")
    try:
        update = json.loads(request.body)
        update_id = update.get("update_id")
        if update_id is not None and not cache.add(f"tg-update:{update_id}", 1, UPDATE_TTL):
            return json_response({})  # повтор от Telegram
        services.handle_update(update)
    except Exception:  # Telegram повторяет не-200 бесконечно: ошибку пишем в лог и отвечаем 200
        log.exception("telegram update failed")
    return json_response({})


@api_view("GET", "POST", "DELETE", business=False)
def link(request):
    existing = TelegramLink.objects.filter(user=request.user).first()
    if request.method == "POST":
        membership = active_membership(request.user)
        if request.user.username == DEMO_USERNAME or (membership and membership.business.is_demo):
            return error(403, "forbidden")
        code = services.create_link_code(request.user)
        return json_response({
            "url": f"https://t.me/{conf.bot_username()}?start={code}", "expires_in": int(services.LINK_TTL.total_seconds()),
        })
    if request.method == "DELETE":
        if existing:
            existing.delete()
        return json_response({"linked": False})
    if existing is None:
        return json_response({"linked": False})
    return json_response({"linked": True, "username": existing.username or None, "lang": existing.lang})


def serialize_settings(row):
    return {**{f: getattr(row, f) for f in FLAGS}, "brief_hour": row.brief_hour, "timezone": row.timezone}


@api_view("GET", "PUT")
def notification_settings(request):
    row = NotificationSettings.objects.filter(user=request.user, business=request.business).first()
    if request.method == "GET":
        return json_response(serialize_settings(row or NotificationSettings()))
    body = parse_json(request)
    for flag in FLAGS:
        if flag in body and not isinstance(body[flag], bool):
            raise ApiError(400, f"{flag}: нужно true или false")
    hour = body.get("brief_hour")
    if "brief_hour" in body and (isinstance(hour, bool) or not isinstance(hour, int) or not 0 <= hour <= 23):
        raise ApiError(400, "brief_hour: целое от 0 до 23")
    row = row or NotificationSettings(user=request.user, business=request.business)
    for key in (*FLAGS, "brief_hour"):
        if key in body:
            setattr(row, key, body[key])
    row.save()
    return json_response(serialize_settings(row))
