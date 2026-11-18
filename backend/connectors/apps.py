import logging

from django.apps import AppConfig
from django.conf import settings


class ConnectorsConfig(AppConfig):
    name = "connectors"

    def ready(self):
        from . import vault

        if not settings.DEBUG and not vault.enabled():
            logging.getLogger(__name__).warning(
                "Vault не настроен (VAULT_ADDR пуст): секреты коннекторов шифруются Fernet от DJANGO_SECRET_KEY")
