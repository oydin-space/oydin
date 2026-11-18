from django.conf import settings
from django.db import models

from accounts.models import Business


class Connector(models.Model):
    """Внешний сервис бизнеса для ИИ-агента: MCP-сервер или простой REST-обработчик."""

    class Kind(models.TextChoices):
        MCP = "mcp"
        REST = "rest"

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="connectors")
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, on_delete=models.SET_NULL, related_name="+")
    kind = models.CharField(max_length=8, choices=Kind.choices)
    name = models.CharField(max_length=60)
    description = models.CharField(max_length=500, blank=True)
    url = models.CharField(max_length=500)  # MCP: адрес сервера; REST: шаблон с {param}
    method = models.CharField(max_length=6, blank=True)  # только REST
    params_schema = models.JSONField(default=dict, blank=True)  # только REST: JSON Schema объекта
    auth_header = models.CharField(max_length=60, blank=True)
    auth_secret_enc = models.TextField(blank=True)  # Fernet-токен; наружу не отдаётся
    tools_cache = models.JSONField(default=list, blank=True)  # только MCP: [{name, description, inputSchema}]
    enabled = models.BooleanField(default=True)
    last_test_ok = models.BooleanField(null=True, blank=True)
    last_test_error = models.CharField(max_length=200, blank=True)
    last_test_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]
