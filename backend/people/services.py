from decimal import Decimal, InvalidOperation

from django.db.models import Q
from django.utils import timezone

from accounts.http import ApiError
from finance import rates
from finance.validation import parse_date

from .models import Location, Person

MAX_PAY = Decimal(10) ** 12
FIELDS = ("name", "kind", "pay_type", "pay_amount", "currency", "location_id", "role_title", "started_on", "ended_on", "note")


def money(value):
    return None if value is None else format(value, "f")


def serialize_person(p):
    return {"id": p.id, "name": p.name, "kind": p.kind, "pay_type": p.pay_type, "pay_amount": money(p.pay_amount),
            "currency": p.currency, "location_id": p.location_id, "role_title": p.role_title,
            "started_on": p.started_on.isoformat() if p.started_on else None,
            "ended_on": p.ended_on.isoformat() if p.ended_on else None, "note": p.note}


def serialize_location(loc):
    return {"id": loc.id, "name": loc.name, "address": loc.address}


def _text(body, key, limit, required=False):
    value = body[key]
    if not isinstance(value, str) or len(value.strip()) > limit or (required and not value.strip()):
        raise ApiError(400, f"invalid_{key}")
    return value.strip()


def location_fields(body, partial):
    out = {}
    if "name" in body or not partial:
        out["name"] = _text(body if "name" in body else {"name": None}, "name", 100, True)
    if "address" in body:
        out["address"] = _text(body, "address", 200)
    return out


def person_fields(business, body, partial):
    out = {}
    if not partial and "name" not in body:
        raise ApiError(400, "invalid_name")
    if "name" in body:
        out["name"] = _text(body, "name", 120, True)
    for key, model_enum in (("kind", Person.Kind), ("pay_type", Person.PayType), ("currency", Person.Currency)):
        if key in body:
            if body[key] not in model_enum.values:
                raise ApiError(400, f"invalid_{key}")
            out[key] = body[key]
    if "pay_amount" in body:
        raw = body["pay_amount"]
        if raw is None:
            out["pay_amount"] = None
        else:
            if isinstance(raw, bool) or not isinstance(raw, (str, int)):
                raise ApiError(400, "invalid_pay_amount")
            try:
                amount = Decimal(str(raw).strip())
            except InvalidOperation:
                raise ApiError(400, "invalid_pay_amount") from None
            if not amount.is_finite() or not 0 <= amount <= MAX_PAY:
                raise ApiError(400, "invalid_pay_amount")
            out["pay_amount"] = amount.quantize(Decimal("0.01"))
    if "location_id" in body:
        lid = body["location_id"]
        if lid is not None:
            if isinstance(lid, bool) or not isinstance(lid, int):
                raise ApiError(400, "invalid_location")
            if not Location.objects.filter(pk=lid, business=business).exists():
                raise ApiError(404, "Точка не найдена")
        out["location_id"] = lid
    for key, limit in (("role_title", 100), ("note", 1000)):
        if key in body:
            out[key] = _text(body, key, limit)
    for key in ("started_on", "ended_on"):
        if key in body:
            out[key] = None if body[key] is None else parse_date(body[key])
    return out


def check_dates(started, ended):
    if started and ended and ended < started:
        raise ApiError(400, "invalid_date")


def active_q(day):
    """Единое правило «действует на дату day»: не раньше начала и не позже последнего дня (ended_on включительно)."""
    return (Q(started_on__isnull=True) | Q(started_on__lte=day)) & (Q(ended_on__isnull=True) | Q(ended_on__gte=day))


def summary(business):
    today = timezone.localdate()
    month_start = today.replace(day=1)
    people = list(Person.objects.filter(business=business))
    active = list(Person.objects.filter(active_q(today), business=business))
    kinds = {k: 0 for k in Person.Kind.values}
    for p in active:
        kinds[p.kind] += 1
    cache, unconverted = {}, set()

    def monthly_uzs(p):
        if p.pay_type != Person.PayType.MONTHLY or not p.pay_amount:
            return Decimal(0)
        if p.currency == "UZS":
            return p.pay_amount
        if p.currency not in ("USD",):  # у ЦБ-курсов в finance нет RUB/EUR
            unconverted.add(p.currency)
            return Decimal(0)
        if p.currency not in cache:
            try:
                cache[p.currency] = rates.get_rate(p.currency)
            except rates.RateUnavailable:
                cache[p.currency] = None
        if cache[p.currency] is None:
            unconverted.add(p.currency)
            return Decimal(0)
        return p.pay_amount * cache[p.currency]

    total = Decimal(0)
    by_loc = {}
    for p in active:
        cost = monthly_uzs(p)
        total += cost
        row = by_loc.setdefault(p.location_id, [0, Decimal(0)])
        row[0] += 1
        row[1] += cost
    names = {loc.id: loc.name for loc in Location.objects.filter(business=business)}
    q = lambda d: format(d.quantize(Decimal("0.01")), "f")
    result = {
        "headcount_by_kind": kinds,
        "monthly_cost_uzs": q(total),
        "by_location": [{"location_id": lid, "name": names.get(lid, ""), "headcount": h, "monthly_cost_uzs": q(c)}
                        for lid, (h, c) in by_loc.items()],
        "turnover_month": {
            "joined": sum(1 for p in people if p.started_on and p.started_on >= month_start and p.started_on <= today),
            "left": sum(1 for p in people if p.ended_on and month_start <= p.ended_on <= today),
        },
    }
    if unconverted:
        result["unconverted"] = sorted(unconverted)
    return result
