"""Индекс живучести («пульс») и «можно потратить сегодня». Чистые функции без ORM."""

from dataclasses import dataclass
from datetime import timedelta

from ..texts import date_text, money, tr

CALM, WATCH, RISK = "calm", "watch", "risk"


@dataclass(frozen=True)
class PulseInput:
    today: object
    balance: int
    points: list  # прогноз минимум на 30 дней
    gap: object  # Gap | None
    obligations: list  # dict: amount, due_date, status, covered, kind
    avg_daily_out: int
    personal_share: float


def runway_days(balance, avg_daily_out):
    if balance <= 0:
        return 0
    if avg_daily_out <= 0:
        return 365
    return min(365, balance // avg_daily_out)


def safe_to_spend(balance, points):
    """Минимальный прогнозный остаток за 30 дней: именно столько можно потратить, не уронив ни один будущий платёж."""
    horizon = [p.balance for p in points[:30]]
    return max(0, min([balance, *horizon]))


def promises(today, obligations):
    """Обещания за окно [-60; +30] дней: выполнено = оплачено или будет покрыто прогнозом."""
    window = [
        o for o in obligations
        if o["kind"] != "receivable" and today - timedelta(days=60) <= o["due_date"] <= today + timedelta(days=30)
    ]
    kept = sum(1 for o in window if o["status"] == "paid" or (o["status"] == "planned" and o["covered"]))
    return kept, len(window)


def score_and_tone(runway, kept, total, gap, today, personal_share):
    runway_part = min(runway, 60) / 60 * 40
    promise_part = (kept / total if total else 1) * 30
    if gap is None:
        gap_part = 20
    else:
        gap_part = min(10, max(0, (gap.date - today).days) / 30 * 10)
    personal_part = max(0.0, 1 - personal_share * 2) * 10
    score = round(runway_part + promise_part + gap_part + personal_part)
    score = max(0, min(100, score))
    if gap is not None:
        tone = RISK if (gap.date - today).days <= 14 else WATCH
        score = min(score, 59 if tone == WATCH else 39)
    elif score >= 70:
        tone = CALM
    else:
        tone = WATCH if score >= 45 else RISK
    return score, tone


def headline(today, gap, obligations, lang="ru"):
    if gap is not None:
        return tr("headline_gap", lang, d=date_text(gap.date, lang), a=money(gap.amount, lang))
    upcoming = [o for o in obligations if o["status"] != "paid" and o["kind"] != "receivable"
                and today <= o["due_date"] <= today + timedelta(days=30)]
    if upcoming:
        last = max(o["due_date"] for o in upcoming)
        return tr("headline_covered", lang, d=date_text(last, lang))
    return tr("headline_calm", lang)


def compute_pulse(data, lang="ru"):
    runway = runway_days(data.balance, data.avg_daily_out)
    kept, total = promises(data.today, data.obligations)
    score, tone = score_and_tone(runway, kept, total, data.gap, data.today, data.personal_share)
    return {
        "score": score,
        "tone": tone,
        "headline": headline(data.today, data.gap, data.obligations, lang),
        "balance": data.balance,
        "safe_to_spend": safe_to_spend(data.balance, data.points),
        "runway_days": int(runway),
        "promises": {"kept": kept, "total": total},
        "gap": None if data.gap is None else {
            "date": data.gap.date.isoformat(), "amount": data.gap.amount, "reason": data.gap.reason,
        },
    }
