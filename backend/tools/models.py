from django.conf import settings
from django.db import models


class SavedTool(models.Model):
    """Сохранённый калькулятор: спецификация OpenUI Lang и последние введённые значения."""

    business = models.ForeignKey("accounts.Business", on_delete=models.CASCADE, related_name="saved_tools")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    title = models.CharField(max_length=120)
    kind = models.CharField(max_length=32)
    spec = models.JSONField()
    pinned = models.BooleanField(default=False)
    values = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-pinned", "-updated_at", "-id"]
