"""Прогноз остатка по дням и поиск кассового разрыва. Чистые функции без ORM."""

from dataclasses import dataclass
from datetime import date, timedelta

from .fmt import money


@dataclass(frozen=True)
class Flow:
    """Запланированное движение денег: amount > 0 — поступление, < 0 — платёж."""

    date: date
    amount: int
    title: str


@dataclass(frozen=True)
class Point:
    date: date
    balance: int
    inflow: int
    outflow: int


@dataclass(frozen=True)
class Gap:
    date: date
    amount: int
    reason: str


def build_forecast(today, balance, flows, daily_in, daily_out, days):
    """Остаток на конец каждого из `days` дней после today. Просроченные потоки падают на завтра."""
    by_day = {}
    for flow in flows:
        day = max(flow.date, today + timedelta(days=1))
        by_day.setdefault(day, []).append(flow)
    points = []
    for offset in range(1, days + 1):
        day = today + timedelta(days=offset)
        planned = by_day.get(day, [])
        inflow = daily_in + sum(f.amount for f in planned if f.amount > 0)
        outflow = daily_out + sum(-f.amount for f in planned if f.amount < 0)
        balance += inflow - outflow
        points.append(Point(day, balance, inflow, outflow))
    return points


def find_gap(points, flows, today, horizon=30):
    """Первая дата в горизонте, где прогнозный остаток уходит ниже нуля; сумма — глубина провала до восстановления."""
    window = [p for p in points if p.date <= today + timedelta(days=horizon)]
    for index, point in enumerate(window):
        if point.balance >= 0:
            continue
        shortfall = 0
        for later in window[index:]:
            if later.balance >= 0:
                break
            shortfall = max(shortfall, -later.balance)
        due = [f for f in flows if max(f.date, today + timedelta(days=1)) == point.date and f.amount < 0]
        if due:
            biggest = min(due, key=lambda f: f.amount)
            reason = f"Платёж «{biggest.title}» на {money(-biggest.amount)}: к этому дню денег на счетах не хватает"
        else:
            reason = "Ежедневные расходы превышают поступления"
        return Gap(point.date, shortfall, reason)
    return None
