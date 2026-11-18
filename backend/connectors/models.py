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
    auth_secret_enc = models.TextField(blank=True)  # шифртекст Vault Transit (или Fernet без Vault); наружу не отдаётся
    tools_cache = models.JSONField(default=list, blank=True)  # только MCP: [{name, description, inputSchema}]
    enabled = models.BooleanField(default=True)
    last_test_ok = models.BooleanField(null=True, blank=True)
    last_test_error = models.CharField(max_length=200, blank=True)
    last_test_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["id"]


class DidoxAccount(models.Model):
    """Подключение бизнеса к Didox: ИНН/ПИНФЛ входа и пароль (шифртекст Vault). Пароль нужен, потому что токен Didox живёт 6 часов."""

    business = models.OneToOneField(Business, on_delete=models.CASCADE, related_name="didox")
    tax_id = models.CharField(max_length=14)
    password_enc = models.TextField()
    name = models.CharField(max_length=300, blank=True)
    last_sync_at = models.DateTimeField(null=True, blank=True)
    last_error = models.CharField(max_length=40, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)


class DidoxDocument(models.Model):
    """Импортированный из Didox документ: защищает от повторного импорта и связывает с черновиком операции."""

    business = models.ForeignKey(Business, on_delete=models.CASCADE, related_name="didox_documents")
    doc_id = models.CharField(max_length=64)
    transaction = models.ForeignKey("finance.Transaction", null=True, on_delete=models.SET_NULL, related_name="+")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["business", "doc_id"], name="didox_doc_unique")]
