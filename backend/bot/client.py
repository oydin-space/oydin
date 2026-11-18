"""Единственное место, где бот ходит в сеть Telegram. Тесты подменяют call() и download_file()."""

import httpx
from django.conf import settings

API = "https://api.telegram.org"


class BotError(Exception):
    def __init__(self, status, description=""):
        super().__init__(f"{status} {description}")
        self.status = status


def call(method, payload=None, *, timeout=15):
    if not settings.TELEGRAM_BOT_TOKEN:
        raise BotError(0, "token not configured")
    try:
        response = httpx.post(f"{API}/bot{settings.TELEGRAM_BOT_TOKEN}/{method}", json=payload or {}, timeout=timeout)
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise BotError(0, type(exc).__name__) from None
    if not data.get("ok"):
        raise BotError(data.get("error_code", response.status_code), data.get("description", ""))
    return data["result"]


def download_file(file_id, *, timeout=30):
    """Файл Telegram → (байты, mime)."""
    info = call("getFile", {"file_id": file_id})
    try:
        response = httpx.get(f"{API}/file/bot{settings.TELEGRAM_BOT_TOKEN}/{info['file_path']}", timeout=timeout)
        response.raise_for_status()
    except httpx.HTTPError as exc:
        raise BotError(0, type(exc).__name__) from None
    path = info["file_path"].lower()
    mime = "image/png" if path.endswith(".png") else "image/webp" if path.endswith(".webp") else "image/jpeg"
    return response.content, mime


def upload_profile_photo(png_bytes, *, timeout=30):
    """setMyProfilePhoto: InputProfilePhotoStatic через multipart (attach://)."""
    if not settings.TELEGRAM_BOT_TOKEN:
        raise BotError(0, "token not configured")
    try:
        response = httpx.post(
            f"{API}/bot{settings.TELEGRAM_BOT_TOKEN}/setMyProfilePhoto",
            data={"photo": '{"type":"static","photo":"attach://avatar"}'},
            files={"avatar": ("profile.png", png_bytes, "image/png")},
            timeout=timeout,
        )
        data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise BotError(0, type(exc).__name__) from None
    if not data.get("ok"):
        raise BotError(data.get("error_code", response.status_code), data.get("description", ""))
    return data["result"]
