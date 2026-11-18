"""«Сколько можно забрать сегодня»: окно до даты зарплаты/аренды по тем же точкам прогноза, что и пульс."""

from datetime import timedelta

from finance import services as fin
from finance.domain import forecast as fc
from finance.models import Obligation, Order

from . import services as svc
from .texts import tr

MAX_DAYS = 90
SALARY_RENT = ("salary", "rent")


def next_friday(today):
    return today + timedelta(days=(4 - today.weekday()) % 7 or 7)


def default_until(business, today):
    due = (Obligation.objects.filter(business=business, kind__in=SALARY_RENT, due_date__gt=today,
                                     due_date__lte=today + timedelta(days=MAX_DAYS))
           .exclude(status="paid").order_by("due_date").values_list("due_date", flat=True).first())
    return (due, "salary_rent") if due else (next_friday(today), "friday")


def dated_items(business, today, until):
    """Плановые платежи окна; просроченные падают на завтра — как в build_forecast."""
    first = today + timedelta(days=1)
    items = []
    for o in Obligation.objects.filter(business=business).exclude(status="paid"):
        day = max(o.due_date, first)
        if day <= until:
            sign = 1 if o.kind == "receivable" else -1
            items.append({"date": day, "title": o.title, "kind": o.kind, "amount": sign * o.amount,
                          "source": "obligation", "ref_id": o.id})
    for order in Order.objects.filter(business=business).exclude(status="paid"):
        remaining = order.total - order.prepaid
        day = max(order.due_date, first)
        if remaining > 0 and day <= until:
            items.append({"date": day, "title": f"Оплата заказа: {order.client}", "kind": "receivable",
                          "amount": remaining, "source": "order", "ref_id": order.id})
    items.sort(key=lambda i: (i["date"], i["amount"]))
    return items


def today_answer(business, until, reason, lang, now=None):
    b = fin.bundle(business, MAX_DAYS, now)
    window = [p for p in b.points if p.date <= until]
    daily_in, daily_out, _ = fin.daily_rates(business, b.today)
    days = len(window)
    inflow = sum(p.inflow for p in window)
    outflow = -sum(p.outflow for p in window)
    low = min(window, key=lambda p: (p.balance, p.date))
    negative = next((p for p in window if p.balance < 0), None)
    reserve = svc.tax_reserve_amount(business, b.today)
    can_take = max(0, low.balance - reserve)
    gap = {"date": negative.date.isoformat(), "amount": -low.balance} if negative else None
    if gap:
        verdict = "gap"
    elif can_take == 0 or can_take * 10 < -outflow:
        verdict = "tight"
    else:
        verdict = "ok"
    items = [{**i, "date": i["date"].isoformat()} for i in dated_items(business, b.today, until)]
    if daily_in:
        items.append({"date": None, "title": tr("avg_sales", lang, n=days), "kind": "daily_sales",
                      "amount": daily_in * days, "source": "average", "ref_id": None,
                      "days": days, "per_day": daily_in})
    if daily_out:
        items.append({"date": None, "title": tr("avg_spend", lang, n=days), "kind": "daily_spend",
                      "amount": -daily_out * days, "source": "average", "ref_id": None,
                      "days": days, "per_day": daily_out})
    return {
        "as_of": b.today.isoformat(), "until": until.isoformat(), "until_reason": reason,
        "balance": b.balance, "can_take": can_take, "verdict": verdict,
        "low": {"date": low.date.isoformat(), "balance": low.balance},
        "gap": gap, "tax_reserve": reserve, "items": items,
        "totals": {"inflow": inflow, "outflow": outflow, "end_balance": window[-1].balance},
    }
