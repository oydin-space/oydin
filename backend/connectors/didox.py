"""Клиент Didox (партнёрский API ЭДО, https://api-docs.didox.uz).

Каждый запрос требует партнёрский токен (``DIDOX_PARTNER_TOKEN`` из окружения) и токен пользователя ``user-key``,
который выдаёт вход по ИНН/ПИНФЛ и паролю Didox (живёт 360 минут). Секреты и идентификаторы в ошибки и логи не попадают:
наружу уходят только короткие коды.
"""

import os

import httpx
from django.conf import settings

TIMEOUT = 10
PAGE_LIMIT = 100
MAX_PAGES = 20
ESF = "002"  # тип документа «счёт-фактура»
SIGNED = 3  # статус «Подписан»
VAT_ACTIVE = 20


class DidoxError(Exception):
    """Код ошибки без деталей запроса: not_configured, bad_credentials, locked, too_many_attempts, unauthorized, unavailable."""


def setting(name, default=""):
    return getattr(settings, name, None) or os.environ.get(name, default)


def base_url():
    return setting("DIDOX_API_URL", "https://api-partners.didox.uz").rstrip("/")


def partner_token():
    token = setting("DIDOX_PARTNER_TOKEN")
    if not token:
        raise DidoxError("not_configured")
    return token


def mask(tax_id):
    """ИНН/ПИНФЛ для показа и логов: только последние 4 цифры."""
    tax_id = str(tax_id or "")
    return "•" * max(len(tax_id) - 4, 0) + tax_id[-4:]


def request(method, path, *, user_key=None, **kwargs):
    headers = {"Partner-Authorization": partner_token(), "Accept": "application/json", "Accept-Language": "ru"}
    if user_key:
        headers["user-key"] = user_key
    try:
        resp = httpx.request(method, base_url() + path, headers=headers, timeout=TIMEOUT, follow_redirects=False, **kwargs)
    except (httpx.HTTPError, httpx.InvalidURL, httpx.StreamError):
        raise DidoxError("unavailable") from None
    if resp.status_code == 401:
        raise DidoxError("unauthorized")
    if resp.status_code == 422:
        raise DidoxError("bad_credentials")
    if resp.status_code == 423:
        raise DidoxError("locked")
    if resp.status_code == 429:
        raise DidoxError("too_many_attempts")
    if resp.status_code == 404:
        return None
    if resp.status_code >= 400:
        raise DidoxError("unavailable")
    try:
        return resp.json()
    except ValueError:
        raise DidoxError("unavailable") from None


def login(tax_id, password):
    """Вход по паролю Didox → (user_key, название аккаунта)."""
    data = request("POST", f"/v1/auth/{tax_id}/password/ru", json={"password": password})
    if not isinstance(data, dict) or not data.get("token"):
        raise DidoxError("bad_credentials")
    return data["token"], str(data.get("name") or "")


def taxpayer(user_key, tax_id):
    """Карточка налогоплательщика из информационных систем НК (/v1/utils/info) или None, если не найден."""
    data = request("GET", f"/v1/utils/info/{tax_id}", user_key=user_key)
    if not isinstance(data, dict):
        return None
    data = data.get("data", data) if isinstance(data.get("data"), dict) else data
    name = data.get("shortName") or data.get("name") or data.get("fullName") or ""
    if not name:
        return None
    vat = data.get("VATRegStatus")
    return {
        "name": str(name),
        "inn": str(data.get("tin") or ""),
        "legal_form": str(data.get("na1Name") or ""),
        "status": str(data.get("statusName") or ""),
        "registered_at": str(data.get("regDate") or ""),
        "address": str(data.get("address") or ""),
        "director": str(data.get("director") or ""),
        "oked": str(data.get("oked") or ""),
        "vat_payer": None if vat is None else vat == VAT_ACTIVE,
        "vat_code": str(data.get("VATRegCode") or ""),
        "self_employed": bool(data.get("selfEmployment")),
    }


def documents(user_key, *, owner, since=None):
    """Подписанные счета-фактуры: owner=1 — исходящие (продажи), owner=0 — входящие (закупки)."""
    params = {"limit": PAGE_LIMIT, "owner": owner, "doctype": ESF, "status": SIGNED}
    if since:
        params["dateFromUpdated"] = since.isoformat()
    out = []
    for page in range(1, MAX_PAGES + 1):
        data = request("GET", "/v2/documents", user_key=user_key, params={**params, "page": page}) or {}
        rows = data.get("data") or []
        out.extend(r for r in rows if isinstance(r, dict))
        if not data.get("next_page_url") or len(rows) < PAGE_LIMIT:
            break
    return out


def parse_date(value):
    """Дата документа Didox: ISO «2024-05-01…» или «01.05.2024»."""
    from datetime import date, datetime

    value = str(value or "")[:10]
    for fmt in ("%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(value, fmt).date()
        except ValueError:
            continue
    return date.today()


def amount_of(row):
    for key in ("total_delivery_sum_with_vat", "total_sum", "total_delivery_sum"):
        try:
            value = round(float(row.get(key) or 0))
        except (TypeError, ValueError):
            continue
        if value > 0:
            return value
    return 0


def sync(account, user=None):
    """Тянет подписанные счета-фактуры и создаёт черновики операций (продажа — приход, закупка — расход).

    Черновик, а не подтверждённая операция: счёт-фактура — это начисление, оплату владелец подтверждает сам.
    Возвращает число новых черновиков.
    """
    from django.db import transaction as db
    from django.utils import timezone

    from finance.models import Account, Transaction

    from . import vault
    from .models import DidoxDocument

    business = account.business
    wallet = (
        Account.objects.filter(business=business, kind=Account.Kind.BANK, currency="UZS").first()
        or Account.objects.filter(business=business, currency="UZS").first()
    )
    if wallet is None:
        raise DidoxError("no_account")
    try:
        password = vault.reveal(account, "password_enc")
    except vault.VaultError as exc:
        raise DidoxError("reconnect_required" if str(exc) == "undecryptable" else "unavailable") from None
    user_key, _ = login(account.tax_id, password)
    since = account.last_sync_at.date() if account.last_sync_at else None
    seen = set(DidoxDocument.objects.filter(business=business).values_list("doc_id", flat=True))
    created = 0
    for owner, direction, category in ((1, Transaction.Direction.IN, "Продажи"), (0, Transaction.Direction.OUT, "Поставщик")):
        for row in documents(user_key, owner=owner, since=since):
            doc_id = str(row.get("doc_id") or row.get("_id") or "")[:64]
            amount = amount_of(row)
            if not doc_id or doc_id in seen or amount <= 0:
                continue
            seen.add(doc_id)
            with db.atomic():
                tx = Transaction.objects.create(
                    business=business, account=wallet, date=parse_date(row.get("doc_date")), amount=amount,
                    direction=direction, category=category, counterparty=str(row.get("partnerCompany") or "")[:200],
                    note=f"Didox ЭСФ № {str(row.get('name') or '')[:60]}".strip(), status=Transaction.Status.DRAFT,
                    source=Transaction.Source.IMPORT, created_by=user,
                )
                DidoxDocument.objects.create(business=business, doc_id=doc_id, transaction=tx)
            created += 1
    account.last_sync_at, account.last_error = timezone.now(), ""
    account.save(update_fields=["last_sync_at", "last_error"])
    return created
