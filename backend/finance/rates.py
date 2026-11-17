"""Курсы ЦБ Узбекистана (cbu.uz) и пересчёт сумм счетов в сумы."""

from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

import httpx
from django.utils import timezone

from accounts.http import ApiError

from .models import Currency, ExchangeRate

CBU_URL = "https://cbu.uz/ru/arkhiv-kursov-valyut/json/{currency}/{day}/"
SOURCE = "cbu.uz"
STALE_DAYS = 3
TIMEOUT = 5
# Сколько минимальных единиц в одной единице валюты: сумы целые, доллары — в центах.
MINOR_UNITS = {Currency.UZS: 1, Currency.USD: 100}


class RateUnavailable(ApiError):
    """Курса нет ни в БД, ни у ЦБ: любой view ответит 503 {"error": "rates_unavailable"}."""

    def __init__(self, detail=""):
        super().__init__(503, "rates_unavailable")
        self.detail = detail


def fetch_cbu_rate(day=None, currency=Currency.USD):
    """Тянет курс на дату (ЦБ отдаёт последний установленный) и сохраняет его. Ошибки сети → RateUnavailable."""
    day = day or timezone.localdate()
    try:
        resp = httpx.get(CBU_URL.format(currency=currency, day=day.isoformat()), timeout=TIMEOUT)
        resp.raise_for_status()
        row = resp.json()[0]
        rate = Decimal(str(row["Rate"])) / Decimal(str(row.get("Nominal") or 1))
        rate_date = datetime.strptime(row["Date"], "%d.%m.%Y").date()
    except (httpx.HTTPError, ValueError, KeyError, IndexError, TypeError, InvalidOperation) as exc:
        raise RateUnavailable(str(exc)) from exc
    obj, _ = ExchangeRate.objects.update_or_create(
        date=rate_date, currency=currency,
        defaults={"rate": rate.quantize(Decimal("0.0001")), "source": SOURCE},
    )
    obj.refresh_from_db()
    return obj


def latest(currency=Currency.USD):
    """Последний сохранённый курс; если курсов нет вовсе — тянем с ЦБ."""
    row = ExchangeRate.objects.filter(currency=currency).order_by("-date", "-id").first()
    return row or fetch_cbu_rate(currency=currency)


def get_rate(currency):
    if currency == Currency.UZS:
        return Decimal(1)
    return latest(currency).rate


def is_stale(row):
    return row.source != SOURCE or row.date < timezone.localdate() - timedelta(days=STALE_DAYS)


def to_uzs(amount, currency, rate=None):
    """Сумма в минимальных единицах валюты счёта → целые сумы (округление до сума)."""
    if currency == Currency.UZS or not amount:
        return amount
    rate = rate if rate is not None else get_rate(currency)
    return int((Decimal(amount) * rate / MINOR_UNITS[currency]).quantize(Decimal(1), rounding=ROUND_HALF_UP))


def rows_to_uzs(rows, key="s"):
    """Сумма по строкам values("account__currency").annotate(s=...) в сумах; курс запрашивается один раз."""
    total, cache = 0, {}
    for row in rows:
        currency, amount = row["account__currency"], row[key] or 0
        if currency != Currency.UZS and amount and currency not in cache:
            cache[currency] = get_rate(currency)
        total += to_uzs(amount, currency, cache.get(currency))
    return total


def serialize(row):
    return {"date": row.date.isoformat(), "USD": format(row.rate.normalize(), "f"), "source": row.source,
            "stale": is_stale(row)}
