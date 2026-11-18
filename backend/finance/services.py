"""Сценарии чтения: собирают данные из БД и вызывают доменные функции."""

import math
from dataclasses import dataclass
from datetime import timedelta

from django.contrib.postgres.search import TrigramWordSimilarity
from django.db.models import Q, Sum
from django.db.models.functions import Greatest
from django.utils import timezone

from accounts.http import ApiError

from .domain import forecast as fc
from .domain import pulse as pl
from .domain.categories import OBLIGATION_CATEGORIES, ORDER_INCOME_CATEGORIES
from .domain.fmt import short_date
from .domain.transfers import Candidate, find_counterpart
from .models import Account, Envelope, GapAlert, Obligation, Order, Product, Transaction
from .rates import rows_to_uzs, to_uzs
from .texts import TRANSFER_CATEGORY, money, tr

PERIOD_DAYS = {"week": 7, "month": 30, "quarter": 90}


def today():
    return timezone.localdate()


def resolve_category(business, name):
    """Категория без дублей: регистронезависимое точное совпадение с существующей возвращает её написание."""
    existing = (
        Transaction.objects.filter(business=business, category__iexact=name)
        .order_by("-id").values_list("category", flat=True).first()
    )
    return existing or name


def confirmed(business):
    return Transaction.objects.filter(business=business, status=Transaction.Status.CONFIRMED)


def uzs(qs):
    """Сумма amount по операциям разных валют, приведённая к сумам."""
    return rows_to_uzs(qs.order_by().values("account__currency").annotate(s=Sum("amount")))


def balance_uzs(business):
    balances = account_balances(business)
    return rows_to_uzs(
        {"account__currency": a.currency, "s": balances[a.id]} for a in Account.objects.filter(business=business)
    )


def account_balances(business):
    balances = {a.id: a.opening_balance for a in Account.objects.filter(business=business)}
    rows = confirmed(business).values("account_id", "direction", "transfer_account_id").annotate(total=Sum("amount"))
    for row in rows:
        if row["direction"] == "in":
            balances[row["account_id"]] += row["total"]
        elif row["direction"] == "out":
            balances[row["account_id"]] -= row["total"]
        elif row["transfer_account_id"]:
            balances[row["account_id"]] -= row["total"]
            balances[row["transfer_account_id"]] += row["total"]
    return balances


def list_accounts(business):
    """Остатки в валюте счёта (balance) и в сумах (balance_uzs)."""
    balances = account_balances(business)
    return [serialize_account(a, balances[a.id]) for a in Account.objects.filter(business=business)]


def serialize_account(a, balance):
    return {"id": a.id, "name": a.name, "kind": a.kind, "currency": a.currency, "balance": balance,
            "balance_uzs": to_uzs(balance, a.currency)}


def period_totals(business, start, end):
    """Итоги периода в сумах. Прибыль — без личных трат и денег владельца; cash_flow — всё движение денег.
    Переводы между своими счетами не считаются."""
    qs = confirmed(business).filter(date__gte=start, date__lte=end)
    inflow, out = qs.filter(direction="in"), qs.filter(direction="out")
    contributions = uzs(inflow.filter(purpose=Transaction.Purpose.OWNER_CONTRIBUTION))
    draws = uzs(out.filter(purpose=Transaction.Purpose.OWNER_DRAW))
    total_in, total_out = uzs(inflow), uzs(out)
    personal = uzs(out.filter(purpose=Transaction.Purpose.PERSONAL))
    revenue = total_in - contributions
    expenses = total_out - personal - draws
    spent = expenses + personal
    return {
        "revenue": revenue,
        "expenses": expenses,
        "personal": personal,
        "profit": revenue - expenses,
        "personal_share": round(personal / spent, 3) if spent else 0.0,
        "owner_draws": draws,
        "owner_contributions": contributions,
        "cash_flow": total_in - total_out,
    }


def daily_rates(business, now):
    """Средний дневной приход и расход за 30 дней вне регулярных обязательств и оплат заказов (их прогноз считает отдельно)."""
    start = now - timedelta(days=30)
    qs = confirmed(business).filter(date__gt=start, date__lte=now)
    inflow = uzs(qs.filter(direction="in").exclude(category__in=ORDER_INCOME_CATEGORIES)
                 .exclude(purpose=Transaction.Purpose.OWNER_CONTRIBUTION))
    outflow = uzs(qs.filter(direction="out").exclude(category__in=OBLIGATION_CATEGORIES))
    total_out = uzs(qs.filter(direction="out"))
    return inflow // 30, outflow // 30, total_out // 30


@dataclass
class Bundle:
    today: object
    balance: int
    flows: list
    points: list
    avg_daily_out: int


def planned_flows(business, now):
    flows = []
    for o in Obligation.objects.filter(business=business).exclude(status="paid"):
        sign = 1 if o.kind == "receivable" else -1
        flows.append(fc.Flow(o.due_date, sign * o.amount, o.title))
    for order in Order.objects.filter(business=business).exclude(status="paid"):
        remaining = order.total - order.prepaid
        if remaining > 0:
            flows.append(fc.Flow(order.due_date, remaining, f"Оплата заказа: {order.client}"))
    return flows


def bundle(business, days=90, now=None):
    now = now or today()
    balance = balance_uzs(business)
    daily_in, daily_out, avg_out = daily_rates(business, now)
    flows = planned_flows(business, now)
    points = fc.build_forecast(now, balance, flows, daily_in, daily_out, days)
    return Bundle(now, balance, flows, points, avg_out)


def notify_gap(business, b, lang="ru"):
    """Первое обнаружение разрыва на дату → событие gap.detected (повторно для той же даты не шлём)."""
    from publicapi.services import emit

    gap = fc.find_gap(b.points, b.flows, b.today, lang=lang)
    if gap is None:
        return gap
    _, created = GapAlert.objects.get_or_create(business=business, gap_date=gap.date)
    if created:
        reason = gap.reason if lang == "ru" else fc.find_gap(b.points, b.flows, b.today).reason
        emit("gap.detected", {"date": gap.date.isoformat(), "amount": gap.amount, "reason": reason}, business)
    return gap


def confirm_draft(tx, merge=False):
    """Черновик → подтверждённая операция и событие transaction.confirmed; зеркальный перевод ищем только при merge=True
    (не для продавца: слияние трогает чужие операции бизнеса)."""
    from publicapi.services import emit

    tx.status = Transaction.Status.CONFIRMED
    tx.save()
    if merge:
        tx = merge_transfer(tx)
    emit("transaction.confirmed", tx)
    return tx


def forecast_points(business, days):
    b90 = bundle(business, 90)
    notify_gap(business, b90)
    return [
        {"date": p.date.isoformat(), "balance": p.balance, "inflow": p.inflow, "outflow": p.outflow}
        for p in (b90 if days == 90 else bundle(business, days)).points
    ]


def obligation_dicts(business, b, only_id=None):
    by_date = {p.date: p.balance for p in b.points}
    result = []
    qs = Obligation.objects.filter(business=business)
    qs = qs.filter(pk=only_id) if only_id else qs.filter(due_date__gte=b.today - timedelta(days=30))
    for o in qs:
        status = o.status
        if status == "planned" and o.due_date < b.today:
            status = "overdue"
        if status == "paid" or o.kind == "receivable":
            covered = True
        else:
            day = max(o.due_date, b.today + timedelta(days=1))
            covered = by_date.get(day, b.points[-1].balance if b.points else b.balance) >= 0
        result.append({
            "id": o.id, "title": o.title, "kind": o.kind, "amount": o.amount,
            "due_date": o.due_date, "status": status, "covered": covered,
        })
    return result


def serialize_obligation(o):
    return {**o, "due_date": o["due_date"].isoformat()}


def envelopes(business, now=None):
    now = now or today()
    return [
        {
            "id": e.id, "title": e.title, "target": e.target, "saved": e.saved,
            "due_date": e.due_date.isoformat(),
            "daily": math.ceil(max(0, e.target - e.saved) / max(1, (e.due_date - now).days)),
        }
        for e in Envelope.objects.filter(business=business)
    ]


def revenue_week(business, end):
    """Выручка за 7 дней по `end` включительно и за 7 дней до них."""
    amount = period_totals(business, end - timedelta(days=6), end)["revenue"]
    prev = period_totals(business, end - timedelta(days=13), end - timedelta(days=7))["revenue"]
    delta = round((amount - prev) / prev * 100) if prev else None
    return {"amount": amount, "prev_amount": prev, "delta_pct": delta}


def pulse(business, now=None, lang="ru", start=None, end=None):
    """start/end — выбранный период для итогов (прибыль, доля личного, выручка за неделю);
    остаток, прогноз и разрыв всегда считаются от сегодня."""
    from planning import services as planning

    b = bundle(business, 90, now)
    gap = notify_gap(business, b, lang)
    obligations = obligation_dicts(business, b)
    end = min(end or b.today, b.today)
    start = start or end - timedelta(days=29)
    month = period_totals(business, start, end)
    result = pl.compute_pulse(pl.PulseInput(
        today=b.today, balance=b.balance, points=b.points, gap=gap, obligations=obligations,
        avg_daily_out=b.avg_daily_out, personal_share=month["personal_share"],
    ), lang)
    tax_reserved = planning.tax_reserve_amount(business, b.today)
    result["tax_reserved"] = tax_reserved
    forecast_safe = result["safe_to_spend"]
    result["safe_to_spend"] = max(0, forecast_safe - tax_reserved)
    # Почему «можно потратить» меньше остатка: остальное зарезервировано под платежи до минимума прогноза и налоги.
    result["reserved_upcoming"] = max(0, b.balance - forecast_safe)
    if b.balance <= 0:
        result["safe_reason"] = "empty"
    elif result["safe_to_spend"] > 0:
        result["safe_reason"] = None
    elif gap is not None:
        result["safe_reason"] = "gap"
    elif forecast_safe > 0:
        result["safe_reason"] = "tax"
    else:
        result["safe_reason"] = "reserved"
    result["revenue_week"] = revenue_week(business, end)
    result["period"] = {"from": start.isoformat(), "to": end.isoformat()}
    result["cash_difference"] = planning.latest_cash_difference(business)
    env = envelopes(business, b.today)
    saved = sum(e["saved"] for e in env)
    target = sum(e["target"] for e in env)
    safe = result["safe_to_spend"]
    weekly_profit = [
        period_totals(business, b.today - timedelta(days=7 * (i + 1) - 1), b.today - timedelta(days=7 * i))["profit"]
        for i in reversed(range(4))
    ]
    share = month["personal_share"]
    result["metrics"] = [
        {"key": "free_money", "label": tr("free_money", lang), "value": safe, "unit": "sum",
         "tone": "calm" if safe > 0 else "watch",
         "hint": tr("free_money_hint", lang)},
        {"key": "reserved", "label": tr("reserved", lang), "value": saved, "unit": "sum",
         "tone": "calm" if target == 0 or saved >= target * 0.5 else "watch",
         "hint": tr("reserved_hint", lang, saved=money(saved, lang), target=money(target, lang)) if target else tr("reserved_none", lang)},
        {"key": "owner_take", "label": tr("owner_take", lang), "value": min(safe, max(month["profit"], 0)), "unit": "sum",
         "tone": "calm" if safe > 0 and month["profit"] > 0 else "watch",
         "hint": tr("owner_take_hint", lang)},
        {"key": "profit", "label": tr("profit", lang), "value": month["profit"], "unit": "sum",
         "tone": "calm" if month["profit"] > 0 else "watch",
         "hint": tr("profit_hint", lang, revenue=money(month["revenue"], lang), expenses=money(month["expenses"], lang)),
         "trend": weekly_profit},
        {"key": "personal_share", "label": tr("personal_share", lang), "value": round(share * 100), "unit": "pct",
         "tone": "calm" if share < 0.15 else "watch",
         "hint": tr("personal_share_hint", lang)},
    ]
    return result


def analytics(business, period, now=None):
    now = now or today()
    days = PERIOD_DAYS[period]
    start = now - timedelta(days=days - 1)
    totals = period_totals(business, start, now)
    out = confirmed(business).filter(direction="out", date__gte=start, date__lte=now)
    cats = {}
    business_out = out.exclude(purpose__in=[Transaction.Purpose.PERSONAL, Transaction.Purpose.OWNER_DRAW])
    by_cat = business_out.order_by().values("category", "account__currency").annotate(s=Sum("amount"))
    for row in by_cat:
        cats[row["category"]] = cats.get(row["category"], 0) + rows_to_uzs([row])
    if totals["personal"]:
        cats["Личное"] = totals["personal"]
    if totals["owner_draws"]:
        cats["Владельцу"] = totals["owner_draws"]
    ranked = sorted(cats.items(), key=lambda kv: -kv[1])
    by_category = [{"label": k, "value": v} for k, v in ranked[:7]]
    rest = sum(v for _, v in ranked[7:])
    if rest:
        by_category.append({"label": "Прочее", "value": rest})
    by_week = []
    weeks = math.ceil(days / 7)
    for i in reversed(range(weeks)):
        end = now - timedelta(days=7 * i)
        begin = max(start, end - timedelta(days=6))
        qs = confirmed(business).filter(date__gte=begin, date__lte=end)
        by_week.append({
            "label": short_date(begin),
            "inflow": uzs(qs.filter(direction="in")),
            "outflow": uzs(qs.filter(direction="out")),
        })
    return {
        "revenue": totals["revenue"], "expenses": totals["expenses"], "profit": totals["profit"],
        "personal_share": totals["personal_share"], "owner_draws": totals["owner_draws"],
        "owner_contributions": totals["owner_contributions"], "cash_flow": totals["cash_flow"],
        "by_category": by_category, "by_week": by_week,
    }


def search_transactions(qs, q):
    """Поиск по заметке/контрагенту/категории: подстрока или триграммное сходство слов (терпит опечатки)."""
    if "\x00" in q:
        raise ApiError(400, "Нулевой символ в запросе недопустим")
    q = q.strip()
    if not q:
        return qs
    return qs.annotate(
        sim=Greatest(
            TrigramWordSimilarity(q, "note"),
            TrigramWordSimilarity(q, "counterparty"),
            TrigramWordSimilarity(q, "category"),
        )
    ).filter(
        Q(note__icontains=q) | Q(counterparty__icontains=q) | Q(category__icontains=q) | Q(sim__gte=0.4)
    ).order_by("-date", "-id")


def merge_transfer(tx):
    """Если у новой операции есть зеркальная на другом счёте — это перевод между своими счетами, а не расход."""
    if tx.direction not in ("in", "out") or tx.status != "confirmed":
        return tx
    nearby = Transaction.objects.filter(
        business=tx.business, status="confirmed", amount=tx.amount, account__currency=tx.account.currency,
        date__gte=tx.date - timedelta(days=1), date__lte=tx.date + timedelta(days=1),
    ).exclude(pk=tx.pk).exclude(direction="transfer").exclude(account=tx.account)
    me = Candidate(tx.pk, tx.account_id, tx.direction, tx.amount, tx.date, tx.counterparty)
    others = {t.pk: t for t in nearby}
    match = find_counterpart(me, [
        Candidate(t.pk, t.account_id, t.direction, t.amount, t.date, t.counterparty) for t in others.values()
    ])
    if match is None:
        return tx
    other = others[match.id]
    source, target = (tx, other) if tx.direction == "out" else (other, tx)
    source.direction = "transfer"
    source.transfer_account_id = target.account_id
    source.category = "Перевод между счетами"
    source.purpose = "business"
    source.save()
    target.delete()
    return source


def serialize_transaction(t, lang="ru"):
    category = tr("transfer", lang) if t.category == TRANSFER_CATEGORY else t.category
    return {
        "id": t.id, "date": t.date.isoformat(), "amount": t.amount, "direction": t.direction,
        "category": category, "purpose": t.purpose, "account_id": t.account_id,
        "counterparty": t.counterparty, "note": t.note, "status": t.status, "source": t.source,
        "to_account_id": t.transfer_account_id,
    }


def serialize_product(p):
    margin = (p.price - p.unit_cost) / p.price * 100 if p.price else 0
    markup = (p.price - p.unit_cost) / p.unit_cost * 100 if p.unit_cost else 0
    return {
        "id": p.id, "name": p.name, "price": p.price, "unit_cost": p.unit_cost,
        "margin_pct": round(margin, 1), "markup_pct": round(markup, 1), "cost_is_estimate": p.cost_is_estimate,
    }


def products(business):
    return [serialize_product(p) for p in Product.objects.filter(business=business)]


def orders(business):
    return [
        {
            "id": o.id, "client": o.client, "channel": o.channel, "total": o.total, "prepaid": o.prepaid,
            "status": o.status, "due_date": o.due_date.isoformat(),
            "items": [{"product_id": i.product_id, "qty": i.qty, "price": i.price} for i in o.items.all()],
        }
        for o in Order.objects.filter(business=business).prefetch_related("items")
    ]
