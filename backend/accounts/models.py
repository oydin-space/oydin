from django.conf import settings
from django.db import models


class Business(models.Model):
    """Организация (тенант). Пользователь получает доступ через Membership."""

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

    class Meta:
        verbose_name_plural = "businesses"

    def __str__(self):
        return self.name


class Profile(models.Model):
    """Пользователь ↔ активный бизнес и внешние идентичности. Доступ к бизнесу даёт только Membership."""

    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="profile")
    business = models.ForeignKey(Business, null=True, blank=True, on_delete=models.SET_NULL, related_name="profiles")
    telegram_id = models.BigIntegerField(null=True, blank=True, unique=True)
    google_sub = models.CharField(max_length=255, null=True, blank=True, unique=True)
    terms_version = models.CharField(max_length=20, blank=True, default="")
    terms_accepted_at = models.DateTimeField(null=True, blank=True)

    def save(self, *args, **kwargs):
        # Профиль, созданный сразу с бизнесом (Telegram, демо, старый код), делает пользователя владельцем.
        adding = self._state.adding
        super().save(*args, **kwargs)
        if adding and self.business_id:
            Membership.objects.get_or_create(
                user_id=self.user_id, business_id=self.business_id, defaults={"role": Membership.Role.OWNER}
            )

    def __str__(self):
        return f"{self.user} → {self.business}"


class Membership(models.Model):
    """Роль пользователя в бизнесе. user=None — приглашение на invited_email, ждёт первого входа."""

    class Role(models.TextChoices):
        OWNER = "owner"
        ACCOUNTANT = "accountant"
        SELLER = "seller"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.CASCADE, related_name="memberships"
    )
    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="memberships")
    role = models.CharField(max_length=12, choices=Role)
    invited_email = models.EmailField(blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
        constraints = [
            models.UniqueConstraint(fields=["user", "business"], name="membership_user_business"),
            models.UniqueConstraint(
                fields=["business", "invited_email"], condition=models.Q(user__isnull=True),
                name="membership_pending_invite",
            ),
        ]

    def __str__(self):
        return f"{self.user or self.invited_email} @ {self.business} ({self.role})"


class EmailCode(models.Model):
    """Одноразовый код входа по почте. Храним только HMAC кода."""

    email = models.EmailField(db_index=True)
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    used = models.BooleanField(default=False)

    class Meta:
        ordering = ["-created_at", "-id"]


class Consent(models.Model):
    """Текущее состояние отдельного согласия пользователя. Условия использования — Profile.terms_version."""

    class Purpose(models.TextChoices):
        AI = "ai"
        MARKETING = "marketing"
        PARTNER_LEADS = "partner_leads"

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="consents")
    purpose = models.CharField(max_length=20, choices=Purpose.choices)
    granted = models.BooleanField(default=False)
    text_version = models.CharField(max_length=20, blank=True, default="")
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["user", "purpose"], name="uniq_consent_user_purpose")]


class ConsentEvent(models.Model):
    """Журнал выдачи и отзыва согласий: только добавление."""

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="consent_events")
    purpose = models.CharField(max_length=20, choices=Consent.Purpose.choices)
    granted = models.BooleanField()
    text_version = models.CharField(max_length=20, blank=True, default="")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
