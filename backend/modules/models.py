from django.db import models


class ModuleState(models.Model):
    business = models.ForeignKey("accounts.Business", on_delete=models.CASCADE, related_name="module_states")
    key = models.CharField(max_length=20)
    enabled = models.BooleanField(default=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["business", "key"], name="uniq_module_state")]
        ordering = ["id"]


class WidgetConfig(models.Model):
    """Одна версия виджета; активна ровно одна на (business, key). История не стирается."""

    business = models.ForeignKey("accounts.Business", on_delete=models.CASCADE, related_name="widget_configs")
    key = models.CharField(max_length=40)
    spec = models.JSONField()
    version = models.PositiveIntegerField()
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["business", "key", "version"], name="uniq_widget_version"),
            models.UniqueConstraint(fields=["business", "key"], condition=models.Q(active=True), name="uniq_widget_active"),
        ]
        ordering = ["key", "-version"]


class WidgetProposal(models.Model):
    class Status(models.TextChoices):
        PENDING = "pending"
        APPROVED = "approved"
        REJECTED = "rejected"

    business = models.ForeignKey("accounts.Business", on_delete=models.CASCADE, related_name="widget_proposals")
    key = models.CharField(max_length=40)
    base_version = models.PositiveIntegerField()
    spec = models.JSONField()
    rationale = models.TextField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    created_by = models.CharField(max_length=10, default="ai")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-id"]


class UsageEvent(models.Model):
    business = models.ForeignKey("accounts.Business", on_delete=models.CASCADE, related_name="widget_usage")
    key = models.CharField(max_length=40)
    action = models.CharField(max_length=10)
    ts = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["business", "key", "ts"])]
