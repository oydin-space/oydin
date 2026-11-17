"""Черновик операции: проверка ответа модели и разбор текста без модели (запасной путь)."""

import re

from finance.models import Account, Transaction
from finance.services import today
from finance.validation import MAX_AMOUNT

DIRECTIONS = {c for c, _ in Transaction.Direction.choices}
PURPOSES = {c for c, _ in Transaction.Purpose.choices}

AMOUNT = re.compile(r"(\d{1,3}(?:[\s\u00a0]\d{3})+|\d+)(?:[.,](\d+))?\s*(млн|миллион\w*|тыс\w*|к(?![а-яё]))?", re.I)
IN_WORDS = re.compile(r"получил|получила|пришл|поступил|продал|выручк|предоплат|клиент\w*\s+(?:заплатил|оплатил|перевел|перевёл)", re.I)
OUT_WORDS = re.compile(r"заплатил|заплатила|оплатил|оплатила|потратил|потратила|купил|купила|отдал|отдала|выдал|выдала|списал|снял|перевёл|перевел", re.I)
PERSONAL = re.compile(r"личн|себе|семь|жене|мужу|дет[яи]м|кофе|обед|ужин|продукт|одежд|такси домой", re.I)
ACCOUNT_KINDS = [
    (re.compile(r"налич", re.I), "cash"),
    (re.compile(r"карт|uzcard|humo", re.I), "card"),
    (re.compile(r"сч[её]т|перечисл|банк", re.I), "bank"),
]
CATEGORIES = [
    (re.compile(r"аренд", re.I), "Аренда"),
    (re.compile(r"зарплат", re.I), "Зарплата"),
    (re.compile(r"налог", re.I), "Налоги"),
    (re.compile(r"кредит", re.I), "Кредит"),
    (re.compile(r"поставщик|заготовк|ткан|закуп", re.I), "Поставщик"),
    (re.compile(r"реклам", re.I), "Реклама"),
    (re.compile(r"такси|бензин|проезд", re.I), "Транспорт"),
    (re.compile(r"кофе|обед|ужин|продукт|еда", re.I), "Питание"),
    (re.compile(r"коммунал|свет|газ|интернет", re.I), "Коммунальные"),
]


def _text(value, limit):
    return value.strip()[:limit] if isinstance(value, str) else ""


def validate_draft(business, raw):
    """Черновик из ответа модели или None, если он неверен (счёт чужой, сумма не целая и т.п.)."""
    if not isinstance(raw, dict):
        return None
    amount = raw.get("amount")
    if isinstance(amount, float) and amount.is_integer():
        amount = int(amount)
    if isinstance(amount, bool) or not isinstance(amount, int) or not 1 <= amount <= MAX_AMOUNT:
        return None
    if raw.get("direction") not in DIRECTIONS:
        return None
    account_id = raw.get("account_id")
    if isinstance(account_id, bool) or not isinstance(account_id, int):
        return None
    if not Account.objects.filter(pk=account_id, business=business).exists():
        return None
    category = _text(raw.get("category"), 80)
    if not category:
        return None
    purpose = raw.get("purpose") if raw.get("purpose") in PURPOSES else "unclear"
    return {
        "amount": amount, "direction": raw["direction"], "category": category, "purpose": purpose,
        "account_id": account_id, "date": today().isoformat(),
        "counterparty": _text(raw.get("counterparty"), 120), "note": _text(raw.get("note"), 300),
    }


def parse_amount(text):
    """Первая сумма в сумах: «4 млн», «150 тысяч», «1 200 000»; None, если нет."""
    for match in AMOUNT.finditer(text):
        whole, fraction, word = match.groups()
        value = float(re.sub(r"\s", "", whole) + ("." + fraction if fraction else ""))
        if word:
            value *= 10**6 if word.lower().startswith(("млн", "милл")) else 10**3
        if value >= 1000:
            return int(round(value))
    return None


def parse_text_draft(business, text):
    """Простой разбор фразы по-русски без модели; None, если суммы или направления не видно."""
    amount = parse_amount(text)
    if amount is None:
        return None
    direction = "in" if IN_WORDS.search(text) else "out" if OUT_WORDS.search(text) else None
    if direction is None:
        return None
    accounts = list(Account.objects.filter(business=business).order_by("id"))
    if not accounts:
        return None
    account = accounts[0]
    for pattern, kind in ACCOUNT_KINDS:
        if pattern.search(text):
            account = next((a for a in accounts if a.kind == kind), account)
            break
    category = next((name for p, name in CATEGORIES if p.search(text)), "Продажи" if direction == "in" else "Прочее")
    purpose = "personal" if direction == "out" and PERSONAL.search(text) else "business" if direction == "out" else "business"
    return {
        "amount": amount, "direction": direction, "category": category, "purpose": purpose,
        "account_id": account.id, "date": today().isoformat(), "counterparty": "", "note": text.strip()[:300],
    }
