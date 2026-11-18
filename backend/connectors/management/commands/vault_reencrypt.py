"""Разовый перенос секретов коннекторов с Fernet в Vault Transit (идемпотентно; остальное доедет ленивым перешифрованием)."""

from django.core.management.base import BaseCommand, CommandError

from connectors import vault
from connectors.models import Connector, DidoxAccount


class Command(BaseCommand):
    help = "Перешифровать секреты коннекторов и пароли Didox в Vault"

    def handle(self, *args, **options):
        if not vault.enabled():
            raise CommandError("VAULT_ADDR не задан")
        done = 0
        for model, field in ((Connector, "auth_secret_enc"), (DidoxAccount, "password_enc")):
            for obj in model.objects.exclude(**{field: ""}).exclude(**{f"{field}__startswith": vault.PREFIX}):
                try:
                    vault.reveal(obj, field)
                except vault.VaultError as exc:
                    raise CommandError(f"vault_{exc}") from None
                done += obj.__dict__[field].startswith(vault.PREFIX)
        self.stdout.write(f"перешифровано: {done}")
