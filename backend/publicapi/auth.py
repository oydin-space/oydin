"""Bearer-аутентификация публичного API: токен → бизнес, scope, лимит запросов."""

import hashlib
import hmac
import secrets
from functools import wraps

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts.http import ApiError, error

from .models import ApiToken

SCOPES = ("read", "write")
TOKEN_PREFIX_LEN = 8


def hash_token(raw):
    return hashlib.sha256(raw.encode()).hexdigest()


def new_token():
    return "oyd_" + secrets.token_urlsafe(32)


def find_token(raw):
    if not raw.startswith("oyd_") or len(raw) < 20:
        return None
    digest = hash_token(raw)
    candidates = ApiToken.objects.filter(prefix=raw[:TOKEN_PREFIX_LEN], revoked_at__isnull=True).select_related("business")
    return next((t for t in candidates if hmac.compare_digest(t.token_hash, digest)), None)


def rate_limit(token):
    """Окно в минуту на токен. Возвращает секунды до сброса, если лимит исчерпан."""
    limit = getattr(settings, "PUBLICAPI_RATE_LIMIT", 60)
    window = 60
    now = int(timezone.now().timestamp())
    slot = now // window
    key = f"publicapi:rl:{token.id}:{slot}"
    cache.add(key, 0, window + 5)
    try:
        used = cache.incr(key)
    except ValueError:
        cache.set(key, 1, window + 5)
        used = 1
    return None if used <= limit else window - now % window


def bearer_view(*methods, scope="read"):
    """Публичный /v1/*: csrf-exempt, Authorization: Bearer, request.business/api_token. Ошибки — {"error": code}."""

    def decorator(view):
        @csrf_exempt
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            if request.method not in methods:
                return error(405, "method_not_allowed")
            header = request.headers.get("Authorization", "")
            kind, _, raw = header.partition(" ")
            token = find_token(raw.strip()) if kind.lower() == "bearer" else None
            if token is None:
                return error(401, "invalid_token")
            if scope not in token.scopes:
                return error(403, "forbidden")
            retry = rate_limit(token)
            if retry is not None:
                response = error(429, "rate_limited")
                response["Retry-After"] = str(retry)
                return response
            ApiToken.objects.filter(pk=token.pk).update(last_used_at=timezone.now())
            request.api_token = token
            request.business = token.business
            try:
                return view(request, *args, **kwargs)
            except ApiError as exc:
                return error(exc.status, exc.message)

        return wrapper

    return decorator
