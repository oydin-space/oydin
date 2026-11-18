from django.conf import settings
from django.db import models


class BusinessProfile(models.Model):
    """Расширенный профиль бизнеса для ИИ (ИНН, деятельность, планы, проблемы); модель accounts не трогаем."""

    business = models.OneToOneField("accounts.Business", on_delete=models.CASCADE, related_name="ai_profile")
    inn = models.CharField(max_length=20, blank=True, default="")
    activity = models.CharField(max_length=300, blank=True, default="")
    plans = models.TextField(blank=True, default="")
    problems = models.TextField(blank=True, default="")


class MemoryFact(models.Model):
    """Долговременный факт, который ИИ помнит: о бизнесе (общий) или о конкретном пользователе (личный)."""

    class Scope(models.TextChoices):
        BUSINESS = "business"
        USER = "user"

    business = models.ForeignKey("accounts.Business", null=True, blank=True, on_delete=models.CASCADE, related_name="memory_facts")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="memory_facts")
    scope = models.CharField(max_length=10, choices=Scope)
    text = models.CharField(max_length=300)
    source = models.CharField(max_length=20, default="chat")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["id"]
