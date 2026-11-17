from django.conf import settings
from django.db import models
from django.utils import timezone

from accounts.models import Business

LANGS = [("ru", "ru"), ("uz", "uz"), ("en", "en")]


class TelegramLink(models.Model):
    """Привязка личного чата Telegram к пользователю."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="telegram_link")
    chat_id = models.BigIntegerField(unique=True)
    username = models.CharField(max_length=64, blank=True, default="")
    lang = models.CharField(max_length=2, choices=LANGS, default="ru")
    created_at = models.DateTimeField(auto_now_add=True)


class LinkCode(models.Model):
    """Одноразовый код привязки; хранится только хеш."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    code_hash = models.CharField(max_length=64, unique=True)
    expires_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    def expired(self):
        return self.expires_at <= timezone.now()


class NotificationSettings(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="+")
    daily_brief = models.BooleanField(default=True)
    gap_alerts = models.BooleanField(default=True)
    weekly_digest = models.BooleanField(default=True)
    tax_reminders = models.BooleanField(default=True)
    brief_hour = models.PositiveSmallIntegerField(default=9)
    timezone = models.CharField(max_length=40, default="Asia/Tashkent")

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "business"], name="notification_settings_user_business")]


class SentNotification(models.Model):
    """Что уже отправлено: уникальность (user, business, kind, key) делает задачи идемпотентными."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="+")
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="+")
    kind = models.CharField(max_length=20)
    key = models.CharField(max_length=60)
    sent_at = models.DateTimeField(default=timezone.now)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "business", "kind", "key"], name="sent_notification_key")]
