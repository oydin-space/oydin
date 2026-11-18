from django.conf import settings
from django.db import models, transaction


class Plan(models.Model):
    """Тариф. Локализуемые поля — {"ru": ..., "uz": ..., "en": ...}; списки — списки строк."""

    code = models.SlugField(unique=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    is_popular = models.BooleanField(default=False)
    icon = models.CharField(max_length=40, default="sprout")
    price_uzs = models.PositiveIntegerField(default=0, help_text="0 = бесплатно")
    period = models.CharField(max_length=10, default="month")
    image = models.CharField(max_length=200, blank=True)
    name = models.JSONField(default=dict, blank=True)
    tagline = models.JSONField(default=dict, blank=True)
    cta_note = models.JSONField(default=dict, blank=True)
    features = models.JSONField(default=dict, blank=True)
    new_features = models.JSONField(default=dict, blank=True)
    missing = models.JSONField(default=dict, blank=True)
    limits = models.JSONField(default=dict, blank=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return self.code

    def save(self, *args, **kwargs):
        if not self.image:
            self.image = f"/pricing/{self.code}.webp"
        with transaction.atomic():
            super().save(*args, **kwargs)
            if self.is_popular:
                Plan.objects.exclude(pk=self.pk).filter(is_popular=True).update(is_popular=False)


class Subscription(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        ACTIVE = "active"

    business = models.OneToOneField("accounts.Business", on_delete=models.CASCADE, related_name="subscription")
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    renews_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)


class Payment(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        PREPARED = "prepared"
        PAID = "paid"
        CANCELLED = "cancelled"

    business = models.ForeignKey("accounts.Business", on_delete=models.CASCADE, related_name="payments")
    user = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL)
    plan = models.ForeignKey(Plan, on_delete=models.PROTECT)
    amount_uzs = models.PositiveIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    click_trans_id = models.CharField(max_length=40, blank=True)
    click_paydoc_id = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    paid_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ["-id"]
