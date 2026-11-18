"""Планирование: «могу ли я позволить», сверка кассы, налоговый резерв, цели, должники, сезонность, повторяющиеся платежи.

Книги (finance.*) здесь только читаются; единственные записи в чужие модели — Obligation(kind=tax) для налоговых
напоминаний и черновик операции при подтверждении повторяющегося платежа."""

import calendar
from collections import defaultdict
from datetime import date, timedelta
from decimal import ROUND_HALF_UP, Decimal

from django.db.models import Sum
from django.db.models.functions import TruncMonth
from django.utils import timezone

from accounts.http import ApiError
from finance import services as fin
from finance.domain import forecast as fc
from finance.models import Account, Envelope, Obligation, Order, Transaction
from finance.rates import RateUnavailable, rows_to_uzs, to_uzs

from .texts import money as tx_money, tr
from .models import Commitment, DebtorReminder, Goal, TaxReserve

AFFORD_HORIZON = 30
AFFORD_MAX_AHEAD = 90
NON_REVENUE_CATEGORIES = {"Кредит", "Займ", "Перевод между счетами"}
TAX_DISCLAIMER = "Плановый резерв денег, не налог к уплате. Размер и сроки подтверждает пользователь или бухгалтер."
SEASONALITY_MONTHS = 12


def add_months(day, months):
    index = day.month - 1 + months
    year, month = day.year + index // 12, index % 12 + 1
    return date(year, month, min(day.day, calendar.monthrange(year, month)[1]))


def next_occurrence(day, frequency):
    return day + timedelta(days=7) if frequency == "weekly" else add_months(day, 1)


# ------------------------------------------------------------------ tax reserve

def period_bounds(period, now):
    if period == "quarter":
        first_month = (now.month - 1) // 3 * 3 + 1
        start = date(now.year, first_month, 1)
        end = add_months(start, 3) - timedelta(days=1)
    else:
        start = now.replace(day=1)
        end = add_months(start, 1) - timedelta(days=1)
    return start, end


def tax_reserve_settings(business):
    obj = TaxReserve.objects.filter(business=business).first()
    return obj or TaxReserve(business=business)


def tax_reserve(business, now=None):
    now = now or fin.today()
    r = tax_reserve_settings(business)
    start, end = period_bounds(r.period, now)
    qs = fin.confirmed(business).filter(
        direction="in", purpose=Transaction.Purpose.BUSINESS, date__gte=start, date__lte=end
    ).exclude(category__in=NON_REVENUE_CATEGORIES)
    if r.base_categories:
        qs = qs.filter(category__in=r.base_categories)
    base = fin.uzs(qs)
    if not r.enabled:
        reserved, provenance = 0, "user_setting"
    elif r.confirmed_amount is not None:
        reserved, provenance = r.confirmed_amount, "accountant_confirmed"
    elif r.method == TaxReserve.Method.FIXED:
        reserved, provenance = r.fixed_amount or 0, "user_setting"
    else:
        reserved = int((Decimal(base) * (r.percent or 0) / 100).quantize(Decimal(1), rounding=ROUND_HALF_UP))
        provenance = "planning_estimate"
    return {
        "enabled": r.enabled, "method": r.method, "fixed_amount": r.fixed_amount,
        "percent": None if r.percent is None else format(r.percent, "f"),
        "period": r.period, "period_from": start.isoformat(), "period_to": end.isoformat(),
        "base_categories": list(r.base_categories), "base_amount": base, "reserved": reserved,
        "confirmed_amount": r.confirmed_amount, "provenance": provenance, "disclaimer": TAX_DISCLAIMER,
    }


def tax_reserve_amount(business, now=None):
    """Сколько денег планово отложено под налоги — вычитается из safe_to_spend."""
    return tax_reserve(business, now)["reserved"]


# ------------------------------------------------------------------ afford

def envelopes_saved(business):
    return Envelope.objects.filter(business=business).aggregate(s=Sum("saved"))["s"] or 0


def occurrences(start, amount, recurring, end):
    days = [start]
    if recurring:
        while (nxt := next_occurrence(days[-1], recurring)) <= end:
            days.append(nxt)
    return [(d, amount) for d in days]


def simulate(points, outflows, buffer):
    """Прогноз после вычета outflows [(date, uzs)]: вердикт, минимум остатка и первый новый разрыв."""
    first_day = max(outflows[0][0], points[0].date)
    spent, i, rows = 0, 0, []
    for p in points:
        while i < len(outflows) and outflows[i][0] <= p.date:
            spent += outflows[i][1]
            i += 1
        if p.date >= first_day:
            rows.append((p, p.balance - spent))
    end = first_day + timedelta(days=AFFORD_HORIZON)
    rows = [r for r in rows if r[0].date <= end]
    low_point, low = min(rows, key=lambda r: (r[1], r[0].date))
    gap = next((p.date for p, b in rows if b < 0 <= p.balance), None)
    verdict = "no" if low < 0 else ("yes" if low >= buffer else "risky")
    return verdict, low, low_point.date, gap


def explain(verdict, amount, low, low_date, gap, buffer, recurring, lang="ru"):
    what = tr("purchase", lang, a=tx_money(amount, lang)) + (tr("repeats", lang) if recurring else "")
    when = tr("first_gap", lang, d=gap.isoformat()) if verdict == "no" and gap else ""
    return tr(verdict, lang, what=what, low=tx_money(low, lang), d=low_date.isoformat(), when=when,
              buf=tx_money(buffer, lang))


RANK = {"no": 0, "risky": 1, "yes": 2}


def afford(business, amount, currency, day=None, title="", recurring=None, now=None, lang="ru"):
    now = now or fin.today()
    day = max(day or now, now)
    if day > now + timedelta(days=AFFORD_MAX_AHEAD):
        raise ApiError(400, "Дата не дальше 90 дней")
    try:
        amount_uzs = to_uzs(amount, currency)
        offset = (day - now).days
        b = fin.bundle(business, offset + AFFORD_HORIZON + 31, now)
    except RateUnavailable:
        raise ApiError(503, "no_rate") from None
    buffer = tax_reserve_amount(business, now) + envelopes_saved(business)
    horizon_end = day + timedelta(days=AFFORD_HORIZON)
    outs = occurrences(day, amount_uzs, recurring, horizon_end)
    verdict, low, low_date, gap = simulate(b.points, outs, buffer)

    alternatives = []
    if verdict != "yes":
        def alt(kind, text, alt_day, alt_amount, alt_outs):
            v = simulate(b.points, alt_outs, buffer)[0]
            if RANK[v] > RANK[verdict]:
                alternatives.append({"kind": kind, "title": text, "date": alt_day.isoformat() if alt_day else None,
                                     "amount": alt_amount, "verdict": v})
        for shift in (7, 14, 30):
            later = day + timedelta(days=shift)
            if later <= now + timedelta(days=AFFORD_MAX_AHEAD) and later + timedelta(days=AFFORD_HORIZON) <= b.points[-1].date:
                before = len(alternatives)
                alt("later_date", tr("later_date", lang, n=shift), later, amount_uzs,
                    occurrences(later, amount_uzs, recurring, later + timedelta(days=AFFORD_HORIZON)))
                if len(alternatives) > before:
                    break
        half = amount_uzs // 2
        if half > 0:
            alt("smaller_amount", tr("smaller", lang, a=tx_money(half, lang)), None, half, occurrences(day, half, recurring, horizon_end))
            second = day + timedelta(days=30)
            if not recurring and second + timedelta(days=AFFORD_HORIZON) <= b.points[-1].date:
                alt("split", tr("split", lang, a=tx_money(half, lang), b=tx_money(amount_uzs - half, lang)), second,
                    half, [(day, half), (second, amount_uzs - half)])
    return {
        "verdict": verdict, "amount_uzs": amount_uzs, "min_balance_after": low,
        "min_balance_date": low_date.isoformat(), "gap_date": gap.isoformat() if gap else None,
        "explanation": explain(verdict, amount_uzs, low, low_date, gap, buffer, recurring, lang),
        "alternatives": alternatives[:3],
        "assumptions": [tr("as1", lang), tr("as2", lang, buf=tx_money(buffer, lang)), tr("as3", lang)],
    }


# ------------------------------------------------------------------ cash close

def expected_balance(account, day):
    """Остаток счёта в его валюте по подтверждённым записям на конец дня."""
    qs = Transaction.objects.filter(business=account.business, status="confirmed", date__lte=day)

    def total(**kw):
        return qs.filter(**kw).aggregate(s=Sum("amount"))["s"] or 0

    return (account.opening_balance + total(account=account, direction="in") - total(account=account, direction="out")
            - total(account=account, direction="transfer") + total(transfer_account=account, direction="transfer"))


def serialize_close(c):
    return {
        "id": c.id, "date": c.date.isoformat(), "account_id": c.account_id, "currency": c.currency,
        "expected": c.expected, "counted": c.counted, "difference": c.difference, "note": c.note,
        "created_by": c.created_by_id, "created_at": c.created_at.isoformat(),
    }


def latest_cash_difference(business):
    """Необъяснённая разница последней сверки по каждому счёту, в сумах (сумма модулей не берётся — знак важен)."""
    from .models import CashClose

    latest = {}
    for c in CashClose.objects.filter(business=business).order_by("-date", "-id"):
        latest.setdefault(c.account_id, c)
    return sum(to_uzs(c.difference, c.currency) for c in latest.values() if c.difference)


# ------------------------------------------------------------------ period result

def period_result(business, start, end):
    t = fin.period_totals(business, start, end)
    missing = []
    qs = Transaction.objects.filter(business=business, status="confirmed", date__gte=start, date__lte=end)
    if qs.filter(purpose=Transaction.Purpose.UNCLEAR).exists():
        missing.append("unclear_purpose")
    from .models import CashClose
    if CashClose.objects.filter(business=business, date__gte=start, date__lte=end).exclude(difference=0).exists():
        missing.append("unexplained_cash")
    from finance.models import Product
    if Product.objects.filter(business=business, cost_is_estimate=True).exists():
        missing.append("unit_costs")
    return {
        "period_from": start.isoformat(), "period_to": end.isoformat(), "currency": "UZS",
        "revenue": t["revenue"], "expenses": t["expenses"], "profit": t["profit"], "cash_change": t["cash_flow"],
        "owner_draws": t["owner_draws"], "owner_contributions": t["owner_contributions"], "missing_data": missing,
    }


# ------------------------------------------------------------------ tax reminders

def sync_tax_obligation(reminder):
    """Напоминание-платёж с суммой ведёт Obligation(kind=tax); остальные случаи его не имеют."""
    if reminder.kind != "payment" or not reminder.amount:
        if reminder.obligation_id:
            reminder.obligation.delete()
            reminder.obligation = None
        return
    status = "paid" if reminder.status == "done" else "planned"
    if reminder.obligation_id:
        o = reminder.obligation
        o.title, o.amount, o.due_date, o.status = reminder.title, reminder.amount, reminder.due_date, status
        o.save()
    else:
        reminder.obligation = Obligation.objects.create(
            business=reminder.business, title=reminder.title, kind="tax", amount=reminder.amount,
            due_date=reminder.due_date, status=status,
        )


def serialize_reminder(r):
    return {
        "id": r.id, "title": r.title, "kind": r.kind, "due_date": r.due_date.isoformat(), "amount": r.amount,
        "status": r.status, "provenance": r.provenance, "notify_telegram": r.notify_telegram,
        "confirmed_by": r.confirmed_by_id, "confirmed_at": r.confirmed_at.isoformat(), "obligation_id": r.obligation_id,
    }


# ------------------------------------------------------------------ goals

def goal_current(business, goal, now):
    if goal.kind == "safety_cushion":
        return fin.balance_uzs(business)
    if goal.kind == "savings":
        return envelopes_saved(business)
    start = now.replace(day=1)
    if goal.kind == "no_personal_leaks":
        return fin.uzs(fin.confirmed(business).filter(direction="out", purpose="personal", date__gte=start, date__lte=now))
    totals = fin.period_totals(business, start, now)
    return totals["revenue"] if goal.kind == "revenue" else totals["expenses"]


def serialize_goal(business, goal, now=None):
    now = now or fin.today()
    current = goal_current(business, goal, now)
    status = goal.status
    if status == "active" and goal.kind in ("safety_cushion", "savings", "revenue") and current >= goal.target:
        status = "achieved"
    return {
        "id": goal.id, "kind": goal.kind, "title": goal.title, "target": goal.target, "current": current,
        "due_date": goal.due_date.isoformat() if goal.due_date else None, "status": status,
    }


# ------------------------------------------------------------------ debtors

def debtors(business, now=None):
    now = now or fin.today()
    entries = defaultdict(list)
    for o in Order.objects.filter(business=business).exclude(status="paid"):
        if o.total - o.prepaid > 0:
            entries[o.client].append((o.due_date, f"Заказ #{o.id}", o.total - o.prepaid))
    for ob in Obligation.objects.filter(business=business, kind="receivable").exclude(status="paid"):
        entries[ob.title].append((ob.due_date, ob.title, ob.amount))
    items = []
    for name, rows in entries.items():
        running, ledger = 0, []
        for due, title, amount in sorted(rows):
            running += amount
            ledger.append({"due_date": due.isoformat(), "title": title, "amount": amount, "running_balance": running})
        oldest = min(r[0] for r in rows)
        items.append({"counterparty": name, "balance": running, "oldest_due_date": oldest.isoformat(),
                      "overdue_days": max(0, (now - oldest).days), "entries": ledger})
    return sorted(items, key=lambda i: -i["balance"])


def reminder_text(counterparty, balance, oldest_due, lang="ru"):
    return tr("debtor", lang, name=counterparty, a=tx_money(balance, lang), due=oldest_due)


def serialize_debtor_reminder(r):
    return {"id": r.id, "counterparty": r.counterparty, "amount": r.amount, "text": r.text, "status": r.status,
            "approved_by": r.approved_by_id, "created_at": r.created_at.isoformat()}


# ------------------------------------------------------------------ seasonality

def seasonality(business, now=None):
    """Множитель выручки по календарным месяцам — только по истории этого бизнеса, нужно ≥ 12 полных месяцев."""
    now = now or fin.today()
    this_month = now.replace(day=1)
    qs = fin.confirmed(business).filter(direction="in", date__lt=this_month).exclude(
        purpose=Transaction.Purpose.OWNER_CONTRIBUTION)
    first = qs.order_by("date").values_list("date", flat=True).first()
    span = 0 if first is None else (this_month.year - first.year) * 12 + this_month.month - first.month
    if span < SEASONALITY_MONTHS:
        return {"status": "insufficient_history", "months": span, "needed": SEASONALITY_MONTHS, "factors": []}
    by_month = defaultdict(list)
    rows = qs.annotate(m=TruncMonth("date")).order_by().values("m", "account__currency").annotate(s=Sum("amount"))
    totals = defaultdict(int)
    for row in rows:
        totals[row["m"]] += rows_to_uzs([row])
    for i in range(span):
        m = add_months(first.replace(day=1), i)
        by_month[m.month].append(totals.get(m, 0))
    mean_all = sum(sum(v) for v in by_month.values()) / span
    factors = [
        {"month": m, "factor": round(sum(by_month[m]) / len(by_month[m]) / mean_all, 2)
         if by_month.get(m) and mean_all else 1.0}
        for m in range(1, 13)
    ]
    return {"status": "ok", "months": span, "needed": SEASONALITY_MONTHS, "factors": factors}


# ------------------------------------------------------------------ commitments

def serialize_commitment(c, now=None):
    now = now or fin.today()
    return {
        "id": c.id, "title": c.title, "direction": c.direction, "category": c.category, "amount": c.amount,
        "account_id": c.account_id, "frequency": c.frequency, "next_date": c.next_date.isoformat(),
        "active": c.active, "due": c.active and c.next_date <= now,
    }


def confirm_commitment(c, user):
    """Подтверждение человеком: черновик операции на next_date, дальше срок сдвигается. Баланс не меняется до подтверждения черновика."""
    from django.db import transaction as db_tx

    with db_tx.atomic():
        tx = Transaction.objects.create(
            business=c.business, account=c.account, date=c.next_date, amount=c.amount, direction=c.direction,
            category=c.category, note=c.title, status=Transaction.Status.DRAFT, source=Transaction.Source.MANUAL,
            created_by=user,
        )
        c.next_date = next_occurrence(c.next_date, c.frequency)
        c.save(update_fields=["next_date"])
    return tx
