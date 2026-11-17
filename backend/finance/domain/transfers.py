"""Распознавание переводов между своими счетами: расход с одного счёта и приход на другой на ту же сумму."""

from dataclasses import dataclass
from datetime import date


@dataclass(frozen=True)
class Candidate:
    id: int | None
    account_id: int
    direction: str
    amount: int
    date: date
    counterparty: str | None = None


def is_transfer_pair(a, b):
    if {a.direction, b.direction} != {"in", "out"}:
        return False
    if a.account_id == b.account_id or a.amount != b.amount:
        return False
    if a.counterparty or b.counterparty:
        return False
    return abs((a.date - b.date).days) <= 1


def find_counterpart(candidate, others):
    for other in others:
        if is_transfer_pair(candidate, other):
            return other
    return None
