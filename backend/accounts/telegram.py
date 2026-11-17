"""Проверка Telegram Mini App initData: https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app"""

import hashlib
import hmac
import json
import time
from urllib.parse import parse_qsl

from django.core.cache import cache

MAX_AGE_SECONDS = 24 * 60 * 60
WIDGET_MAX_AGE_SECONDS = 10 * 60
MAX_FUTURE_SECONDS = 60


class InvalidInitData(Exception):
    pass


def validate_init_data(init_data, bot_token, *, now=None):
    """Возвращает словарь пользователя Telegram или бросает InvalidInitData."""
    if not bot_token:
        raise InvalidInitData("Вход через Telegram не настроен")
    pairs = dict(parse_qsl(init_data, keep_blank_values=True))
    received_hash = pairs.pop("hash", None)
    if not received_hash:
        raise InvalidInitData("Нет подписи")
    check_string = "\n".join(f"{key}={pairs[key]}" for key in sorted(pairs))
    secret = hmac.new(b"WebAppData", bot_token.encode(), hashlib.sha256).digest()
    expected = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received_hash):
        raise InvalidInitData("Неверная подпись")
    try:
        auth_date = int(pairs["auth_date"])
    except (KeyError, ValueError):
        raise InvalidInitData("Нет даты авторизации") from None
    age = (now if now is not None else time.time()) - auth_date
    if age > MAX_AGE_SECONDS or age < -MAX_FUTURE_SECONDS:
        raise InvalidInitData("Данные устарели")
    try:
        user = json.loads(pairs["user"])
        user["id"] = int(user["id"])
    except (KeyError, ValueError, TypeError):
        raise InvalidInitData("Нет пользователя") from None
    return user


def validate_widget(data, bot_token, *, now=None):
    """Telegram Login Widget: https://core.telegram.org/widgets/login#checking-authorization
    Возвращает словарь пользователя; ошибки — коды not_configured / invalid / invalid_hash / expired."""
    if not bot_token:
        raise InvalidInitData("not_configured")
    fields = {k: str(v) for k, v in data.items() if v is not None}
    received_hash = fields.pop("hash", None)
    if not received_hash:
        raise InvalidInitData("invalid_hash")
    check_string = "\n".join(f"{key}={fields[key]}" for key in sorted(fields))
    secret = hashlib.sha256(bot_token.encode()).digest()
    expected = hmac.new(secret, check_string.encode(), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, received_hash):
        raise InvalidInitData("invalid_hash")
    try:
        auth_date = int(fields["auth_date"])
        user = {**data, "id": int(data["id"])}
    except (KeyError, ValueError, TypeError):
        raise InvalidInitData("invalid") from None
    age = (now if now is not None else time.time()) - auth_date
    if age > WIDGET_MAX_AGE_SECONDS or age < -MAX_FUTURE_SECONDS:
        raise InvalidInitData("expired")
    # Одноразовость: тот же hash второй раз не принимаем, пока payload не протух.
    if not cache.add(f"tg_widget:{received_hash}", 1, max(1, int(WIDGET_MAX_AGE_SECONDS - age))):
        raise InvalidInitData("invalid_hash")
    return user
