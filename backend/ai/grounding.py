"""Проверка, что числа в ответе ИИ взяты из данных: «ничего не выдумывать»."""

import math
import re

# Порядок важен: длинные ключи раньше «m»/«k» (mlrd, mln, ming начинаются на «m»).
MULTIPLIERS = {
    "млрд": 10**9, "млн": 10**6, "миллион": 10**6, "тыс": 10**3,
    "mlrd": 10**9, "bn": 10**9, "billion": 10**9, "mln": 10**6, "million": 10**6, "ming": 10**3, "thousand": 10**3,
    "m": 10**6, "k": 10**3,
}
NUMBER = re.compile(
    r"(?<![\d.,])(\d{1,3}(?:[\s\u00a0]\d{3})+|\d+)(?:[.,](\d+))?\s*"
    r"(млрд|млн|миллион\w*|тыс\w*|mlrd|mln|million\w*|billion\w*|bn|ming|thousand\w*|[mk](?![a-zа-я]))?", re.I
)
MIN_CHECKED = 10_000  # числа поменьше (дни, проценты, даты, количества) не проверяем
TOLERANCE = 0.06  # «2,5 млн» против 2 480 000


def numbers_in(text):
    """Суммы из текста: значения ≥ MIN_CHECKED или с множителем (млн/тыс)."""
    found = []
    for match in NUMBER.finditer(text):
        whole, fraction, word = match.groups()
        value = float(re.sub(r"\s", "", whole) + ("." + fraction if fraction else ""))
        if word:
            value *= MULTIPLIERS[next(k for k in MULTIPLIERS if word.lower().startswith(k))]
        elif value < MIN_CHECKED or value in range(1900, 2100):
            continue
        found.append(value)
    return found


def collect(data, into):
    if isinstance(data, bool):
        return
    if isinstance(data, (int, float)):
        into.add(abs(float(data)))
    elif isinstance(data, dict):
        for v in data.values():
            collect(v, into)
    elif isinstance(data, list | tuple):
        for v in data:
            collect(v, into)
    elif isinstance(data, str):
        into.update(numbers_in(data))


class Evidence:
    """Числа из фактов и результатов инструментов (+ суммы/разности пар — «аренда + зарплата»)."""

    def __init__(self, *sources):
        self.values = set()
        for s in sources:
            self.add(s)

    def add(self, data):
        collect(data, self.values)

    def supports(self, value):
        value = abs(value)
        if value < MIN_CHECKED:
            return True
        base = sorted(self.values, reverse=True)[:120]
        candidates = list(base)
        for i, a in enumerate(base):
            for b in base[i + 1:]:
                candidates += [a + b, abs(a - b)]
        return any(abs(value - c) <= max(TOLERANCE * value, 1) for c in candidates)


def ungrounded_numbers(text, evidence):
    return [n for n in numbers_in(text) if not evidence.supports(n)]


CHART_TYPES = {"bar", "line", "area", "pie"}


def valid_chart(chart, evidence):
    """Нормализованный график или None, если форма неверна или значения не из данных."""
    if not isinstance(chart, dict) or chart.get("type") not in CHART_TYPES:
        return None
    data = chart.get("data")
    if not isinstance(data, list) or not 1 <= len(data) <= 12:
        return None
    points = []
    for p in data:
        if not isinstance(p, dict) or not isinstance(p.get("label"), str) or isinstance(p.get("value"), bool):
            return None
        value = p.get("value")
        if not isinstance(value, (int, float)) or not math.isfinite(value) or not evidence.supports(value):
            return None
        points.append({"label": p["label"][:40], "value": value})
    title = chart.get("title")
    unit = chart.get("unit")
    if not isinstance(title, str) or not isinstance(unit, str):
        return None
    return {"type": chart["type"], "title": title[:80], "unit": unit[:20], "data": points}
