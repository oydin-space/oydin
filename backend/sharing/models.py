from django.conf import settings
from django.db import models

from accounts.models import Business


class ShareLink(models.Model):
    """Ссылка бухгалтеру только для чтения. Сам токен не хранится — только sha256."""

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="share_links")
    label = models.CharField(max_length=120, blank=True, default="")
    token_hash = models.CharField(max_length=64, unique=True)
    period_from = models.DateField()
    period_to = models.DateField()
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    views = models.PositiveIntegerField(default=0)
    last_viewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-created_at", "-id"]


class Partner(models.Model):
    class Kind(models.TextChoices):
        BANK = "bank"
        MFO = "mfo"

    name = models.CharField(max_length=120)
    kind = models.CharField(max_length=4, choices=Kind)
    logo_url = models.CharField(max_length=300, null=True, blank=True)

    class Meta:
        ordering = ["name", "id"]

    def __str__(self):
        return self.name


class PartnerStaff(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="partner_staff")
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="staff")


class PartnerConsent(models.Model):
    """Журнал согласий: одна строка на выдачу; действует, пока revoked_at пуст."""

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="partner_consents")
    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="consents")
    granted_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    text_version = models.CharField(max_length=40)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="+"
    )

    class Meta:
        ordering = ["-granted_at", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["business", "partner"], condition=models.Q(revoked_at__isnull=True), name="one_active_consent"
            )
        ]


class PartnerLeadState(models.Model):
    class Status(models.TextChoices):
        NEW = "new"
        CONTACTED = "contacted"
        CLOSED = "closed"

    partner = models.ForeignKey(Partner, on_delete=models.CASCADE, related_name="lead_states")
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="+")
    status = models.CharField(max_length=10, choices=Status, default=Status.NEW)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["partner", "business"], name="one_lead_state")]
