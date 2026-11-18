"""Секреты коннекторов в HashiCorp Vault (Transit, ключ ``oydin-creds``).

``VAULT_ADDR`` и ``VAULT_TOKEN`` берутся из окружения. Токен периодический, политика даёт только encrypt/decrypt
на этом ключе. Шифртекст Vault выглядит как ``vault:v1:…``; старые значения (Fernet от SECRET_KEY) читаются и при
чтении лениво перешифровываются. Без VAULT_ADDR (локально и в тестах) работает прежний Fernet, если не задан VAULT_REQUIRED=1 (прод).
Plaintext, токены и ответы Vault в ошибки и логи не попадают.
"""

import base64
import os

import httpx
from django.conf import settings

from . import crypto

KEY = "oydin-creds"
PREFIX = "vault:"
TIMEOUT = 5


class VaultError(Exception):
    """Код без деталей: not_configured, unavailable, denied."""


def _setting(name):
    return getattr(settings, name, None) or os.environ.get(name, "")


def enabled():
    return bool(_setting("VAULT_ADDR"))


def _call(action, payload):
    addr, token = _setting("VAULT_ADDR").rstrip("/"), _setting("VAULT_TOKEN")
    if not addr or not token:
        raise VaultError("not_configured")
    try:
        resp = httpx.post(
            f"{addr}/v1/transit/{action}/{KEY}",
            json=payload,
            headers={"X-Vault-Token": token},
            timeout=TIMEOUT,
            follow_redirects=False,
        )
    except (httpx.HTTPError, httpx.InvalidURL, httpx.StreamError):
        raise VaultError("unavailable") from None
    if resp.status_code in (401, 403):
        raise VaultError("denied")
    if resp.status_code != 200:
        raise VaultError("unavailable")
    try:
        return resp.json()["data"]
    except (ValueError, KeyError, TypeError):
        raise VaultError("unavailable") from None


def _flag(name, default):
    value = _setting(name)
    return default if value in ("", None) else str(value).strip().lower() in ("1", "true", "yes", "on")


def required():
    """VAULT_REQUIRED=1: без Vault секреты не пишутся (никакого тихого отката на Fernet)."""
    return _flag("VAULT_REQUIRED", False)


def context(instance, field):
    """Привязка шифртекста к арендатору и полю (ключ Transit derived): чужую строку в свою запись не перенести."""
    return base64.b64encode(f"{type(instance).__name__}:{instance.business_id}:{field}".encode()).decode()


def encrypt(plaintext, context=None):
    if not plaintext:
        return ""
    if not enabled():
        if required():
            raise VaultError("not_configured")
        return crypto.encrypt(plaintext)
    payload = {"plaintext": base64.b64encode(plaintext.encode()).decode()}
    if context:
        payload["context"] = context
    try:
        return _call("encrypt", payload)["ciphertext"]
    except (KeyError, TypeError, ValueError):
        raise VaultError("unavailable") from None


def decrypt(token, context=None):
    if not token:
        return ""
    if not token.startswith(PREFIX):
        if not _flag("VAULT_LEGACY_READ", True):
            raise VaultError("undecryptable")
        plain = crypto.decrypt(token)  # значение до перехода на Vault
        if not plain:
            raise VaultError("undecryptable")  # crypto глотает InvalidToken (смена SECRET_KEY): не считаем это «секрета нет»
        return plain
    payload = {"ciphertext": token}
    if context:
        payload["context"] = context
    try:
        return base64.b64decode(_call("decrypt", payload)["plaintext"]).decode()
    except (KeyError, TypeError, ValueError):  # binascii.Error и UnicodeDecodeError — подклассы ValueError
        raise VaultError("unavailable") from None


def reveal(instance, field):
    """Расшифровывает поле модели; старое значение (Fernet) при включённом Vault перешифровывает и сохраняет.
    Запись условная (CAS по старому шифртексту): параллельно сохранённый новый секрет не затирается."""
    token = getattr(instance, field)
    ctx = context(instance, field)
    plain = decrypt(token, ctx)
    if plain and enabled() and not token.startswith(PREFIX):
        try:
            new = encrypt(plain, ctx)
        except VaultError:
            return plain  # Vault недоступен: прочитали, перешифруем в следующий раз
        if type(instance).objects.filter(pk=instance.pk, **{field: token}).update(**{field: new}):
            setattr(instance, field, new)
    return plain
