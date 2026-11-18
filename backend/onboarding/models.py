"""Онбординг-агент: личный профиль пользователя, сессия знакомства и журнал поиска в реестрах."""

from django.conf import settings
from django.db import models


class UserProfile(models.Model):
    """Личные данные пользователя, которых нет в auth.User (имя и фамилия остаются на User)."""

    class Channel(models.TextChoices):
        APP = "app"
        TELEGRAM = "telegram"
        EMAIL = "email"

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="onboarding_profile")
    language = models.CharField(max_length=2, blank=True, default="")
    phone = models.CharField(max_length=16, blank=True, default="")
    telegram = models.CharField(max_length=64, blank=True, default="")
    preferred_channel = models.CharField(max_length=10, choices=Channel, default=Channel.APP)
    brief_time = models.TimeField(null=True, blank=True)
    pwa_installed_at = models.DateTimeField(null=True, blank=True)
    install_prompt_dismissed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class OnboardingSession(models.Model):
    """Состояние знакомства: одна сессия на пользователя; шаги и черновик ответов — в JSON."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="onboarding_session")
    business = models.ForeignKey("accounts.Business", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    current_step = models.CharField(max_length=20, default="consent")
    steps = models.JSONField(default=dict)
    answers = models.JSONField(default=dict)
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)


class RegistryLookup(models.Model):
    """Один поиск в реестре: кэш ответа (по ключу-хэшу идентификатора), источник и аудит «кто искал»."""

    class Status(models.TextChoices):
        FOUND = "found"
        MULTIPLE = "multiple"
        NOT_FOUND = "not_found"
        UNAVAILABLE = "unavailable"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="registry_lookups")
    key = models.CharField(max_length=64, db_index=True)
    kind = models.CharField(max_length=8)
    status = models.CharField(max_length=12, choices=Status)
    source = models.CharField(max_length=20, blank=True, default="")
    candidates = models.JSONField(default=list)
    fetched_at = models.DateTimeField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]
