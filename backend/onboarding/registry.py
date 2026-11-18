"""Поиск компании по ИНН/ПИНФЛ/названию: официальный партнёрский API (Didox), затем скрапинг orginfo.uz.

Любой сбой источника превращается в статус ``unavailable`` — онбординг продолжается ручным вводом.
ПИНФЛ не сохраняется: в журнале только HMAC-SHA256-ключ.
"""

import hashlib
import hmac
import html
import logging
import os
import re
import urllib.parse
import urllib.request
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.utils import timezone

from connectors import didox as didox_api

from .models import RegistryLookup

log = logging.getLogger(__name__)

TIMEOUT = 6
CACHE_TTL = timedelta(days=90)
RATE_LIMIT_PER_HOUR = 20
MAX_CANDIDATES = 5
UA = "Mozilla/5.0 (compatible; OydinBot/1.0; +https://oydin.uz)"
ORGINFO = "https://orginfo.uz"


class SourceError(Exception):
    """Источник недоступен или ответил неожиданно."""


class RateLimited(Exception):
    pass


def setting(name, default=""):
    return getattr(settings, name, None) or os.environ.get(name, default)


def classify(query):
    """('inn'|'pinfl'|'name', нормализованное значение) или (None, '') для мусора."""
    q = (query or "").strip()
    digits = re.sub(r"[\s-]", "", q)
    if digits.isdigit():
        if len(digits) == 9:
            return "inn", digits
        if len(digits) == 14:
            return "pinfl", digits
        return None, ""
    q = re.sub(r"\s+", " ", q)
    return ("name", q) if 3 <= len(q) <= 120 else (None, "")


def lookup_key(kind, value):
    return hmac.new(settings.SECRET_KEY.encode(), f"{kind}:{value.lower()}".encode(), hashlib.sha256).hexdigest()


def fetch(url, headers=None):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Language": "ru", **(headers or {})})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:  # noqa: S310 — фиксированные https-хосты
            return resp.read(2_000_000).decode("utf-8", "replace")
    except Exception as exc:  # сеть, таймаут, HTTP-ошибки — для онбординга это одно «недоступно»
        raise SourceError(str(exc)) from exc


def candidate(**fields):
    """Единая форма кандидата для карточки подтверждения. vat_payer/self_employed — None, если источник их не знает."""
    base = {"name": "", "inn": "", "legal_form": "", "status": "", "registered_at": "", "address": "", "director": "", "oked": "", "activity": ""}
    base.update({k: (v or "").strip() if isinstance(v, str) else (v or "") for k, v in fields.items() if k in base})
    base["vat_payer"] = fields.get("vat_payer")
    base["self_employed"] = fields.get("self_employed")
    return base


# --- Didox (официальный партнёрский API: данные информационных систем Налогового комитета) ---------

DIDOX_KEY_CACHE = "registry:didox:user_key"
DIDOX_KEY_TTL = 5 * 3600  # токен Didox живёт 6 часов


def didox_user_key():
    """Служебный user-key: DIDOX_USER_KEY или вход сервисного аккаунта DIDOX_LOGIN_TAX_ID/DIDOX_LOGIN_PASSWORD."""
    key = setting("DIDOX_USER_KEY") or cache.get(DIDOX_KEY_CACHE)
    if key:
        return key
    tax_id, password = setting("DIDOX_LOGIN_TAX_ID"), setting("DIDOX_LOGIN_PASSWORD")
    if not (tax_id and password):
        return None
    key, _ = didox_api.login(tax_id, password)
    cache.set(DIDOX_KEY_CACHE, key, DIDOX_KEY_TTL)
    return key


def didox(kind, value):
    if kind == "name" or not setting("DIDOX_PARTNER_TOKEN"):
        return None
    try:
        user_key = didox_user_key()
        if not user_key:
            return None
        card = didox_api.taxpayer(user_key, value)
    except didox_api.DidoxError as exc:
        if str(exc) == "unauthorized":
            cache.delete(DIDOX_KEY_CACHE)
        raise SourceError(str(exc)) from None
    if card is None:
        return []
    card["inn"] = card["inn"] or (value if kind == "inn" else "")
    return [candidate(**card)]


# --- orginfo.uz (неофициальный агрегатор, скрапинг) ------------------------------------------------

CARD_RE = re.compile(r'<a[^>]+href="(/ru/organization/[0-9a-f]+/)"[^>]*og-card[^>]*>(.*?)</a>', re.S)


def strip(fragment):
    text = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", fragment, flags=re.S)
    text = re.sub(r"<br\s*/?>|</(p|div|li|h\d|span|td|th|dt|dd|a)>", "\n", text)
    text = html.unescape(re.sub(r"<[^>]+>", " ", text))
    return [line for line in (re.sub(r"[ \t\xa0]+", " ", ln).strip() for ln in text.split("\n")) if line]


def parse_search(page):
    """Карточки результатов поиска orginfo → [(путь, кандидат)]."""
    out = []
    for path, body in CARD_RE.findall(page):
        title = re.search(r'<h6[^>]*card-title[^>]*>(.*?)</h6>', body, re.S)
        inn = re.search(r"\b(\d{9})\b", re.sub(r"<[^>]+>", " ", body))
        date = re.search(r"\b(\d{2}\.\d{2}\.\d{4})\b", body)
        addr = re.search(r'<p[^>]*text-body-tertiary[^>]*>(.*?)</p>', body, re.S)
        name = " ".join(strip(title.group(1))) if title else ""
        if not name:
            continue
        out.append(
            (
                path,
                candidate(
                    name=name,
                    inn=inn.group(1) if inn else "",
                    registered_at=date.group(1) if date else "",
                    address=" ".join(strip(addr.group(1))) if addr else "",
                ),
            )
        )
    return out[:MAX_CANDIDATES]


LABELS = {
    "Дата регистрации": "registered_at",
    "Статус": "status",
    "ИНН": "inn",
    "ОКЭД": "oked",
    "Адрес": "address",
    "Руководитель": "director",
    "Организационно-правовая форма": "legal_form",
}


def parse_organization(page):
    """Страница организации: заголовок h1 и пары «метка → значение» (первое вхождение метки)."""
    title = re.search(r'<h1[^>]*h1-seo[^>]*>(.*?)</h1>', page, re.S)
    lines = strip(page)
    fields = {}
    for i, line in enumerate(lines[:-1]):
        key = LABELS.get(line.rstrip(":"))
        if key and key not in fields:
            value = lines[i + 1]
            if key == "oked":
                code = value.split(" ")[0]
                rest = lines[i + 2] if value.rstrip().endswith("-") and i + 2 < len(lines) else value.partition("-")[2]
                fields["oked"], fields["activity"] = code, rest.strip(" -")
            elif key == "address" and i + 2 < len(lines) and lines[i + 2] not in LABELS:
                fields[key] = f"{value}, {lines[i + 2]}"
            else:
                fields[key] = value
    if title:
        fields["name"] = " ".join(strip(title.group(1)))
    return candidate(**fields)


def orginfo(kind, value):
    if kind == "pinfl" or str(setting("ONBOARDING_SCRAPE_ENABLED", "1")).lower() in {"0", "false", "no"}:
        return None
    page = fetch(f"{ORGINFO}/ru/search/all/?{urllib.parse.urlencode({'q': value})}")
    found = parse_search(page)
    if kind == "inn":
        found = [f for f in found if f[1]["inn"] == value]
    if len(found) == 1:
        path, card = found[0]
        try:
            detail = parse_organization(fetch(ORGINFO + path))
            card.update({k: v for k, v in detail.items() if v})
        except SourceError:
            pass  # карточка из поиска уже пригодна для подтверждения
    return [card for _, card in found]


PROVIDERS = (("didox", didox), ("orginfo", orginfo))


def search(kind, value):
    """(status, source, candidates) — первый ответивший источник выигрывает."""
    for source, provider in PROVIDERS:
        try:
            result = provider(kind, value)
        except SourceError as exc:
            log.info("registry %s failed: %s", source, exc)
            continue
        if result is None:
            continue
        if result:
            return ("found" if len(result) == 1 else "multiple"), source, result
        if source == PROVIDERS[-1][0]:
            return "not_found", source, []
    return "unavailable", "", []


def lookup(user, query):
    """Поиск с кэшем (90 дней для удачных ответов) и лимитом 20/час на пользователя."""
    kind, value = classify(query)
    if not kind:
        return None
    limit_key = f"registry:lookup:{user.pk}"
    cache.add(limit_key, 0, 3600)
    try:
        count = cache.incr(limit_key)
    except ValueError:
        cache.set(limit_key, 1, 3600)
        count = 1
    if count > RATE_LIMIT_PER_HOUR:
        raise RateLimited()
    key = lookup_key(kind, value)
    cached = (
        RegistryLookup.objects.filter(key=key, status__in=["found", "multiple"], fetched_at__gte=timezone.now() - CACHE_TTL)
        .order_by("-fetched_at")
        .first()
    )
    if cached:
        status, source, candidates, fetched = cached.status, cached.source, cached.candidates, cached.fetched_at
    else:
        status, source, candidates = search(kind, value)
        fetched = timezone.now()
    row = RegistryLookup.objects.create(
        user=user, key=key, kind=kind, status=status, source=source, candidates=candidates, fetched_at=fetched
    )
    return row


def serialize(row):
    return {
        "lookup_id": row.id,
        "kind": row.kind,
        "status": row.status,
        "source": row.source or None,
        "official": row.source == "didox",
        "candidates": row.candidates,
        "fetched_at": row.fetched_at.isoformat(),
    }
