from django.conf import settings
from django.db import models

from accounts.models import Business
from finance.models import Account


class ImportJob(models.Model):
    class Kind(models.TextChoices):
        CSV = "csv"
        XLSX = "xlsx"
        BANK_1C = "1c_bank"
        COMMERCEML = "commerceml"

    class Status(models.TextChoices):
        PREVIEW = "preview"
        COMMITTED = "committed"
        FAILED = "failed"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="import_jobs")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name="import_jobs"
    )
    kind = models.CharField(max_length=12, choices=Kind)
    filename = models.CharField(max_length=255)
    status = models.CharField(max_length=10, choices=Status, default=Status.PREVIEW)
    # Колонки файла и строки как текст: превью пересчитывается при смене маппинга без повторной загрузки.
    columns = models.JSONField(default=list)
    rows = models.JSONField(default=list)
    mapping = models.JSONField(default=dict)
    mapping_confidence = models.FloatField(default=0)
    signature = models.CharField(max_length=40)
    account = models.ForeignKey(Account, null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    created_count = models.IntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]


class ImportMapping(models.Model):
    """Подтверждённый маппинг: тот же набор колонок у бизнеса подхватывается без AI."""

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="import_mappings")
    signature = models.CharField(max_length=40)
    mapping = models.JSONField(default=dict)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["business", "signature"], name="import_mapping_signature")]
