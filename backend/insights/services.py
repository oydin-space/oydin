from datetime import timedelta

from django.db.models import Sum

from finance import services as fin
from finance.domain import forecast as fc
from finance.domain.categories import OBLIGATION_CATEGORIES
from finance.texts import date_text, money
from finance.texts import tr as tr_fin

from . import catalog
from .staff import staff_insights
from .texts import tr


def _own_category_growth(business, now, lang):
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
    pct = round(growth * 100)
    return {
        "id": "own-category-growth",
        "kind": "own",
        "title": tr("growth_title", lang, category=category, pct=pct),
        "body": tr("growth_body", lang, category=category, a=money(value, lang), pct=pct),
        "tone": "watch",
        "source": tr("growth_source", lang),
        "source_url": None,
        "as_of": now,
        "confidence": "high",
        "action": tr("growth_action", lang, category=category),
    }


def _own_gap(business, now, lang):
    b = fin.bundle(business, 30, now)
    gap = fc.find_gap(b.points, b.flows, now, lang=lang)
    if gap is None:
        return None
    return {
        "id": "own-cash-gap",
        "kind": "own",
        "title": tr_fin("headline_gap", lang, d=date_text(gap.date, lang), a=money(gap.amount, lang)),
        "body": tr("gap_body", lang, reason=gap.reason),
        "tone": "risk" if (gap.date - now).days <= 14 else "watch",
        "source": tr("gap_source", lang),
        "source_url": None,
        "as_of": now,
        "confidence": "medium",
        "action": tr("gap_action", lang),
    }


def build_insights(business, now=None, lang="ru"):
    now = now or fin.today()
    items = [i for i in (_own_gap(business, now, lang), _own_category_growth(business, now, lang)) if i]
    items += catalog.market_local(lang)
    items += staff_insights(business, now, lang)
    return [{**i, "as_of": i["as_of"].isoformat()} for i in items]
