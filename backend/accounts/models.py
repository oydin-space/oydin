from django.conf import settings
from django.db import models


class Business(models.Model):
    class TaxRegime(models.TextChoices):
        UNKNOWN = "unknown"
        TURNOVER = "turnover"
        SIMPLIFIED_VAT = "simplified_vat"
        GENERAL = "general"

    name = models.CharField(max_length=200)
    industry = models.CharField(max_length=100, blank=True)
    city = models.CharField(max_length=100, blank=True)
    tax_regime = models.CharField(max_length=20, choices=TaxRegime, default=TaxRegime.UNKNOWN)
    is_demo = models.BooleanField(default=False)

    def __str__(self):
        return self.name


class Profile(models.Model):
    """Пользователь ↔ бизнес. Один пользователь — один бизнес (пилот)."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="profiles")
    telegram_id = models.BigIntegerField(null=True, blank=True, unique=True)

    def __str__(self):
        return f"{self.user} → {self.business}"
