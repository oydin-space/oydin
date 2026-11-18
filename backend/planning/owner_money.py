"""Деньги владельца: отдельно от денег бизнеса, и трёхсторонний раздел текущих чистых денег.

Раздел: 1) «держит бизнес на плаву» — обязательства и повторяющиеся платежи на 30 дней вперёд плюс месячная зарплата
из people.Person; 2) остаток делится по долям «развитие» / «себе», которые задаёт владелец. Ничего не прогнозируется,
кроме тех списков, что уже есть в книгах."""

from datetime import timedelta
from decimal import Decimal

from accounts.http import ApiError
from finance import services as fin
from finance.models import Account, Obligation, Transaction
from finance.rates import RateUnavailable
from people import services as people_svc

from . import services as svc
from .models import Commitment, OwnerSplit

HORIZON_DAYS = 30
DEFAULT_PCT = (50, 50)


def largest_remainder(total, weights):
    """Целочисленный раздел total пропорционально weights; сумма частей ровно total (метод наибольшего остатка)."""
    weight_sum = sum(weights)
    if total <= 0 or weight_sum <= 0:
        return [0] * len(weights)
    exact = [total * w for w in weights]
    parts = [e // weight_sum for e in exact]
    leftover = total - sum(parts)
    order = sorted(range(len(weights)), key=lambda i: (-(exact[i] % weight_sum), i))
    for i in order[:leftover]:
        parts[i] += 1
    return parts


def split_settings(business):
    obj = OwnerSplit.objects.filter(business=business).first()
    if obj is None:
        return {"development_pct": DEFAULT_PCT[0], "owner_pct": DEFAULT_PCT[1], "configured": False}
    return {"development_pct": obj.development_pct, "owner_pct": obj.owner_pct, "configured": True}


def save_split(business, development_pct, owner_pct):
    OwnerSplit.objects.update_or_create(business=business, defaults={
        "development_pct": development_pct, "owner_pct": owner_pct})


def owner_flows(business, now):
    """Выплаты владельцу и его вложения: за текущий месяц и за 30 дней."""
    month_start = now.replace(day=1)
    qs = fin.confirmed(business).filter(date__lte=now)

    def total(purpose, start):
        return fin.uzs(qs.filter(purpose=purpose, date__gte=start))

    last30 = now - timedelta(days=HORIZON_DAYS - 1)
    return {
        "draw_month": total(Transaction.Purpose.OWNER_DRAW, month_start),
        "contribution_month": total(Transaction.Purpose.OWNER_CONTRIBUTION, month_start),
        "draw_30d": total(Transaction.Purpose.OWNER_DRAW, last30),
        "contribution_30d": total(Transaction.Purpose.OWNER_CONTRIBUTION, last30),
    }


def committed(business, now, payroll, drop_salary):
    """Исходящие на 30 дней: обязательства (кроме полученных к оплате и оплаченных), повторяющиеся платежи, зарплата."""
    end = now + timedelta(days=HORIZON_DAYS)
    obligations = Obligation.objects.filter(business=business, due_date__lte=end).exclude(
        status=Obligation.Status.PAID).exclude(kind=Obligation.Kind.RECEIVABLE)
    if drop_salary:  # зарплата берётся из people.Person, иначе обязательство salary посчиталось бы дважды
        obligations = obligations.exclude(kind=Obligation.Kind.SALARY)
    items = [{"kind": "obligation", "title": o.title, "date": o.due_date.isoformat(), "amount": o.amount,
              "overdue": o.due_date < now} for o in obligations]
    for c in Commitment.objects.filter(business=business, direction="out", active=True, next_date__lte=end):
        for day, amount in svc.occurrences(max(c.next_date, now), c.amount, c.frequency, end):
            items.append({"kind": "commitment", "title": c.title, "date": day.isoformat(), "amount": amount, "overdue": False})
    items.sort(key=lambda i: (i["date"], i["title"]))
    return items


def split(business, now=None):
    now = now or fin.today()
    try:
        balance = fin.balance_uzs(business)
        owner = owner_flows(business, now)
    except RateUnavailable:
        raise ApiError(503, "no_rate") from None
    people = people_svc.summary(business)
    payroll = int(Decimal(people["monthly_cost_uzs"]).to_integral_value())
    unconverted = people.get("unconverted", [])
    items = committed(business, now, payroll, drop_salary=payroll > 0 and not unconverted)
    obligations_total = sum(i["amount"] for i in items)
    tax = svc.tax_reserve_amount(business, now)
    saved = svc.envelopes_saved(business)
    set_aside = tax + saved
    net = balance - set_aside
    need = obligations_total + payroll
    settings = split_settings(business)
    free = max(net - need, 0)
    afloat = min(max(net, 0), need)
    dev, mine = largest_remainder(free, [settings["development_pct"], settings["owner_pct"]])
    if unconverted:  # фонд зарплаты занижен — свободную сумму честно посчитать нельзя
        dev = mine = None
    return {
        "as_of": now.isoformat(), "horizon_days": HORIZON_DAYS,
        "balance": balance, "tax_reserve": tax, "envelopes": saved, "net": net,
        "shortfall": max(need - max(net, 0), 0),
        "afloat": {"amount": afloat, "needed": need, "payroll": payroll, "obligations": obligations_total,
                   "payroll_unconverted": unconverted, "items": items},
        "development": {"amount": dev, "pct": settings["development_pct"]},
        "owner": {"amount": mine, "pct": settings["owner_pct"]},
        "uncomputable_reason": "payroll_unconverted" if unconverted else None,
        "configured": settings["configured"],
        "owner_money": owner,
    }
