from datetime import timedelta

from django.db.models import Sum

from finance import services as fin
from finance.domain import forecast as fc
from finance.domain.categories import OBLIGATION_CATEGORIES
from finance.domain.fmt import money, ru_date

from . import catalog


def _own_category_growth(business, now):
    qs = fin.confirmed(business).filter(direction="out", purpose="business").exclude(category__in=OBLIGATION_CATEGORIES)
    recent = {r["category"]: r["s"] for r in qs.filter(date__gt=now - timedelta(days=30), date__lte=now)
              .values("category").annotate(s=Sum("amount"))}
    previous = {r["category"]: r["s"] for r in qs.filter(date__gt=now - timedelta(days=60), date__lte=now - timedelta(days=30))
                .values("category").annotate(s=Sum("amount"))}
    best = None
    for category, value in recent.items():
        before = previous.get(category, 0)
        if before >= 100_000 and value > before:
            growth = (value - before) / before
            if growth >= 0.1 and (best is None or value - before > best[3]):
                best = (category, growth, value, value - before)
    if best is None:
        return None
    category, growth, value, _ = best
    return {
        "id": "own-category-growth",
        "kind": "own",
        "title": f"Расходы «{category}» выросли на {round(growth * 100)}%",
        "body": f"За 30 дней на «{category}» ушло {money(value)} — на {round(growth * 100)}% больше, чем в предыдущие 30 дней.",
        "tone": "watch",
        "source": "Ваши подтверждённые операции",
        "source_url": None,
        "as_of": now,
        "confidence": "high",
        "action": f"Почему выросли расходы на «{category}»?",
    }


def _own_gap(business, now):
    b = fin.bundle(business, 30, now)
    gap = fc.find_gap(b.points, b.flows, now)
    if gap is None:
        return None
    return {
        "id": "own-cash-gap",
        "kind": "own",
        "title": f"{ru_date(gap.date)} не хватит {money(gap.amount)}",
        "body": f"{gap.reason}. Это прогноз по вашим платежам и обычному темпу продаж.",
        "tone": "risk" if (gap.date - now).days <= 14 else "watch",
        "source": "Прогноз Oydin по вашим операциям и обязательствам",
        "source_url": None,
        "as_of": now,
        "confidence": "medium",
        "action": "Как закрыть кассовый разрыв?",
    }


def build_insights(business, now=None):
    now = now or fin.today()
    items = [i for i in (_own_gap(business, now), _own_category_growth(business, now)) if i]
    items += catalog.MARKET_LOCAL
    return [{**i, "as_of": i["as_of"].isoformat()} for i in items]
