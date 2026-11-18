"""Общие помощники JSON-API: единый формат ошибок, авторизация, разбор тела."""

import json
from functools import wraps

from django.http import JsonResponse


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


def error(status, message):
    return JsonResponse({"error": message}, status=status, json_dumps_params={"ensure_ascii": False})


def json_response(data, status=200):
    return JsonResponse(data, status=status, safe=False, json_dumps_params={"ensure_ascii": False})


def _has_nul(value):
    if isinstance(value, str):
        return "\x00" in value
    if isinstance(value, dict):
        return any(_has_nul(k) or _has_nul(v) for k, v in value.items())
    if isinstance(value, list):
        return any(_has_nul(v) for v in value)
    return False


def parse_json(request, *, required=True):
    if request.method in ("POST", "PUT", "PATCH") and request.body and request.content_type != "application/json":
        raise ApiError(415, "unsupported_media_type")
    if not request.body:
        if required:
            raise ApiError(400, "Нужно тело запроса в формате JSON")
        return {}
    try:
        body = json.loads(request.body)
    except ValueError:
        raise ApiError(400, "Некорректный JSON") from None
    if not isinstance(body, dict):
        raise ApiError(400, "Тело запроса должно быть объектом JSON")
    if _has_nul(body):
        raise ApiError(400, "Нулевой символ в тексте недопустим")
    return body


def api_view(*methods, auth=True, business=True):
    """Ограничивает методы, требует вход и переводит ApiError в {"error": ...}.
    Для авторизованных запросов кладёт request.business/membership/role (accounts.access);
    business=True — без активного бизнеса 403 {"error": "no_business"}."""

    def decorator(view):
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            if request.method not in methods:
                return error(405, "Метод не поддерживается")
            if auth:
                if not request.user.is_authenticated:
                    return error(401, "Нужно войти")
                from .access import resolve

                if resolve(request) is None and business:
                    return error(403, "no_business")
            try:
                return view(request, *args, **kwargs)
            except ApiError as exc:
                return error(exc.status, exc.message)

        return wrapper

    return decorator
