from django.core.management.base import BaseCommand, CommandError

from bot import client, conf


class Command(BaseCommand):
    help = "Регистрирует вебхук Telegram: set_telegram_webhook https://oydin.example"

    def add_arguments(self, parser):
        parser.add_argument("base_url")

    def handle(self, *args, base_url, **options):
        url = base_url.rstrip("/") + "/api/telegram/webhook/"
        try:
            client.call("setWebhook", {
                "url": url, "secret_token": conf.webhook_secret(), "allowed_updates": ["message", "callback_query"],
            })
        except client.BotError as exc:
            raise CommandError(f"Telegram: {exc}") from None
        self.stdout.write(f"Webhook: {url}")
