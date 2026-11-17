import hashlib
import hmac
import os

from django.conf import settings


def bot_username():
    return os.environ.get("TELEGRAM_BOT_USERNAME", "oydin_agent")


def webhook_secret():
    """Секрет вебхука из SECRET_KEY и токена: меняется с любым из них."""
    msg = f"telegram-webhook:{settings.TELEGRAM_BOT_TOKEN}".encode()
    return hmac.new(settings.SECRET_KEY.encode(), msg, hashlib.sha256).hexdigest()
