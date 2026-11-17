"""Вебхуки: постановка в очередь (emit), подписанная доставка, ретраи с бэкоффом."""

import hashlib
import hmac
import json
import secrets
import uuid
from datetime import timedelta

import httpx
from django.db import transaction
from django.utils import timezone

from . import ssrf
from .models import WebhookDelivery, WebhookEndpoint

EVENTS = ("transaction.created", "transaction.confirmed", "gap.detected")
TIMEOUT = 5
# Паузы перед повторами 2-й, 3-й и 4-й попыток: 1м/10м/1ч.
BACKOFF = (timedelta(minutes=1), timedelta(minutes=10), timedelta(hours=1))


def new_secret():
    return "whsec_" + secrets.token_urlsafe(24)


def sign(secret, timestamp, body):
    mac = hmac.new(secret.encode(), f"{timestamp}.".encode() + body, hashlib.sha256)
    return "sha256=" + mac.hexdigest()


def _payload(event, data):
    return {"id": str(uuid.uuid4()), "event": event, "created_at": timezone.now().isoformat(), "data": data}


def emit(event, data, business=None):
    """Ставит доставки события всем активным подписчикам бизнеса после коммита транзакции.
    data — готовый dict или finance.Transaction (бизнес берётся из неё)."""
    from finance import services as fin

    if hasattr(data, "business_id"):
        business = business or data.business
        data = fin.serialize_transaction(data)
    business_id = getattr(business, "pk", business)

    def enqueue():
        for endpoint in WebhookEndpoint.objects.filter(business_id=business_id, active=True):
            if event in endpoint.events:
                create_delivery(endpoint, event, data)

    transaction.on_commit(enqueue)


def create_delivery(endpoint, event, data):
    payload = _payload(event, data)
    return WebhookDelivery.objects.create(
        endpoint=endpoint, delivery_id=payload["id"], event=event,
        body=json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
        next_attempt_at=timezone.now(),
    )


def attempt(delivery):
    """Одна попытка отправки. Возвращает HTTP-статус получателя или None. Не ретраит."""
    endpoint = delivery.endpoint
    body = delivery.body.encode()
    timestamp = str(int(timezone.now().timestamp()))
    headers = {
        "Content-Type": "application/json", "X-Oydin-Event": delivery.event,
        "X-Oydin-Delivery": str(delivery.delivery_id), "X-Oydin-Timestamp": timestamp,
        "X-Oydin-Signature": sign(endpoint.secret, timestamp, body),
    }
    delivery.attempts += 1
    status, error = None, ""
    try:
        ssrf.check_url(endpoint.url)
        status = httpx.post(endpoint.url, content=body, headers=headers, timeout=TIMEOUT, follow_redirects=False).status_code
    except ssrf.UnsafeUrl as exc:
        error = str(exc)
    except httpx.HTTPError as exc:
        error = type(exc).__name__
    delivery.response_status = status
    delivery.last_error = error[:200]
    endpoint.last_delivery_status = status
    endpoint.save(update_fields=["last_delivery_status"])
    return status


def process(delivery):
    status = attempt(delivery)
    if status is not None and 200 <= status < 300:
        delivery.status = WebhookDelivery.Status.DELIVERED
        delivery.next_attempt_at = None
    elif delivery.attempts > len(BACKOFF) or delivery.last_error in ("private_address", "only_https"):
        delivery.status = WebhookDelivery.Status.FAILED
        delivery.next_attempt_at = None
    else:
        delivery.next_attempt_at = timezone.now() + BACKOFF[delivery.attempts - 1]
    delivery.save()
    return delivery


def deliver_due(limit=100):
    due = WebhookDelivery.objects.filter(
        status=WebhookDelivery.Status.PENDING, next_attempt_at__lte=timezone.now(), endpoint__active=True
    ).select_related("endpoint")[:limit]
    return [process(d) for d in due]


def ping(endpoint):
    """Тестовая подписанная доставка (без ретраев). Возвращает статус получателя или None."""
    payload = _payload("ping", {"ping": True})
    delivery = WebhookDelivery.objects.create(
        endpoint=endpoint, delivery_id=payload["id"], event="ping",
        body=json.dumps(payload, ensure_ascii=False, separators=(",", ":")),
    )
    status = attempt(delivery)
    ok = status is not None and 200 <= status < 300
    delivery.status = WebhookDelivery.Status.DELIVERED if ok else WebhookDelivery.Status.FAILED
    delivery.save()
    return status
