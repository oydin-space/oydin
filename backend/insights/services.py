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


def _tax(business, now):
    regime = business.tax_regime
    if regime == "unknown":
        return None
    month = fin.period_totals(business, now - timedelta(days=29), now)
    revenue, profit = month["revenue"], month["profit"]
    if regime in catalog.TAX_RATES:
        rate = catalog.TAX_RATES[regime]
        amount = round(revenue * rate)
        name = "оборотный налог" if regime == "turnover" else "упрощённый НДС"
        body = f"При режиме «{name}» {round(rate * 100)}% с выручки {money(revenue)} за 30 дней налог — около {money(amount)}."
        if regime == "turnover":
            body += " Для ИП с оборотом до 1 млрд с 2026 года ставка может быть 1% — проверьте свой случай."
    else:
        vat = round(revenue * catalog.VAT_GENERAL)
        income = round(max(profit, 0) * catalog.PROFIT_TAX)
        amount = vat + income
        body = (f"При общем режиме НДС 12% с выручки — около {money(vat)}, налог на прибыль 15% — около {money(income)}; "
                f"вместе около {money(amount)} (НДС без вычета входящего).")
    return {
        "id": f"tax-{regime}",
        "kind": "tax",
        "title": f"Налог за 30 дней: около {money(amount)}",
        "body": body + " Это ориентир, а не налоговая консультация. Способ оплаты (наличные или перевод) НДС не определяет.",
        "tone": "calm",
        "source": catalog.TAX_SOURCE,
        "source_url": catalog.TAX_URL,
        "as_of": catalog.CURATED_AS_OF,
        "confidence": "medium",
        "action": "Как подготовиться к налоговому платежу?",
    }


def build_insights(business, now=None):
    now = now or fin.today()
    items = [i for i in (_own_gap(business, now), _own_category_growth(business, now), _tax(business, now)) if i]
    items += catalog.MARKET_LOCAL
    return [{**i, "as_of": i["as_of"].isoformat()} for i in items]
