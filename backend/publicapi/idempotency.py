"""Idempotency-Key: повтор в течение 24ч с тем же телом возвращает первый ответ (200)."""

import hashlib
import json
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.http import JsonResponse
from django.utils import timezone

from accounts.http import ApiError

from .models import IdempotencyRecord

TTL = timedelta(hours=24)
MAX_KEY = 80


def _response(status, body):
    return JsonResponse(json.loads(body), status=status, safe=False, json_dumps_params={"ensure_ascii": False})


def run(request, business, scope, handler):
    """handler() → JsonResponse 2xx. Без заголовка просто вызывает handler."""
    key = request.headers.get("Idempotency-Key")
    if not key:
        return handler()
    if len(key) > MAX_KEY:
        raise ApiError(400, "invalid_idempotency_key")
    digest = hashlib.sha256(request.body or b"").hexdigest()
    records = IdempotencyRecord.objects.filter(business=business, scope=scope, key=key)
    records.filter(created_at__lt=timezone.now() - TTL).delete()
    existing = records.first()
    if existing is None:
        response = handler()
        if 200 <= response.status_code < 300:
            try:
                with transaction.atomic():
                    IdempotencyRecord.objects.create(
                        business=business, scope=scope, key=key, request_hash=digest,
                        response_status=response.status_code, response_body=response.content.decode(),
                    )
            except IntegrityError:
                existing = records.first()
        if existing is None:
            return response
    if existing.request_hash != digest:
        raise ApiError(409, "idempotency_conflict")
    return _response(200, existing.response_body)
