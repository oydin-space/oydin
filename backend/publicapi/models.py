from django.conf import settings
from django.db import models

from accounts.models import Business


class ApiToken(models.Model):
    """Личный токен бизнеса. Секрет показывается один раз; храним SHA-256 и префикс для поиска."""

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="api_tokens")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    name = models.CharField(max_length=80)
    prefix = models.CharField(max_length=8, db_index=True)
    token_hash = models.CharField(max_length=64)
    scopes = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)
    last_used_at = models.DateTimeField(null=True, blank=True)
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["id"]


class WebhookEndpoint(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="webhook_endpoints")
    url = models.URLField(max_length=500)
    events = models.JSONField(default=list)
    secret = models.CharField(max_length=80)  # нужен в открытом виде для HMAC
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_delivery_status = models.IntegerField(null=True, blank=True)

    class Meta:
        ordering = ["id"]


class WebhookDelivery(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        DELIVERED = "delivered"
        FAILED = "failed"

    endpoint = models.ForeignKey(WebhookEndpoint, on_delete=models.CASCADE, related_name="deliveries")
    delivery_id = models.UUIDField(unique=True)
    event = models.CharField(max_length=40)
    body = models.TextField()  # точные байты, которые подписываем и отправляем
    status = models.CharField(max_length=10, choices=Status, default=Status.PENDING)
    attempts = models.PositiveSmallIntegerField(default=0)
    next_attempt_at = models.DateTimeField(null=True, blank=True)
    response_status = models.IntegerField(null=True, blank=True)
    last_error = models.CharField(max_length=200, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["status", "next_attempt_at"])]


class IdempotencyRecord(models.Model):
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="+")
    scope = models.CharField(max_length=40)
    key = models.CharField(max_length=80)
    request_hash = models.CharField(max_length=64)
    response_status = models.PositiveSmallIntegerField()
    response_body = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["business", "scope", "key"], name="uniq_idempotency_key")]


class SyncRecord(models.Model):
    """Применённая офлайн-запись PWA: повтор client_id возвращает исходный id."""

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="+")
    client_id = models.CharField(max_length=64)
    kind = models.CharField(max_length=20)
    object_id = models.BigIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["business", "client_id"], name="uniq_sync_client_id")]
