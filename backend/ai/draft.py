"""Черновик операции: проверка ответа модели и разбор текста без модели (запасной путь)."""

import re

from finance.models import Account, Transaction
from finance.services import today
from finance.validation import MAX_AMOUNT

from .categories import canonical as canonical_category

DIRECTIONS = {c for c, _ in Transaction.Direction.choices}
PURPOSES = {c for c, _ in Transaction.Purpose.choices}

UZ_TENS = {"o'n": 10, "yigirma": 20, "o'ttiz": 30, "qirq": 40, "ellik": 50, "oltmish": 60, "yetmish": 70, "sakson": 80, "to'qson": 90, "yuz": 100}
UZ_ONES = {"bir": 1, "ikki": 2, "uch": 3, "to'rt": 4, "besh": 5, "olti": 6, "yetti": 7, "sakkiz": 8, "to'qqiz": 9}
MILLION = r"млн|миллион\w*|mln|million\w*"
THOUSAND = r"тыс\w*|ming\w*|к(?![а-яё])"
AMOUNT = re.compile(rf"(\d{{1,3}}(?:[\s\u00a0]\d{{3}})+|\d+)(?:[.,](\d+))?\s*({MILLION}|{THOUSAND})?", re.I)
WORD_AMOUNT = re.compile(
    rf"(?P<half>пол(?:тора|торы)|пол\s?(?=миллион)|yarim)\s*(?P<unit>{MILLION})?|(?P<tens>{'|'.join(map(re.escape, UZ_TENS))})\s+(?P<ones>{'|'.join(map(re.escape, UZ_ONES))})?\s*(?P<uzunit>{MILLION}|{THOUSAND})",
    re.I,
)
IN_WORDS = re.compile(
    r"получил|получила|пришл|поступил|продал|выручк|предоплат|клиент\w*\s+(?:заплатил|оплатил|перевел|перевёл)"
    r"|mijoz\w*\s.*(?:to'ladi|toʻladi|o'tkazdi|oʻtkazdi|berdi)|tushdi|keldi|sotdim", re.I)
OUT_WORDS = re.compile(
    r"заплатил|заплатила|оплатил|оплатила|потратил|потратила|купил|купила|отдал|отдала|выдал|выдала|списал|снял|перевёл|перевел"
    r"|to'ladim|toʻladim|berdim|sotib oldim|o'tkazdim|oʻtkazdim|sarfladim|xarajat", re.I)
PERSONAL = re.compile(r"личн|себе|семь|жене|мужу|дет[яи]м|кофе|обед|ужин|продукт|одежд|такси домой|подар|oilam|shaxsiy", re.I)
ACCOUNT_KINDS = [
    (re.compile(r"налич|naqd", re.I), "cash"),
    (re.compile(r"карт|uzcard|humo|karta", re.I), "card"),
    (re.compile(r"сч[её]т|перечисл|банк|р/с|hisob|bank", re.I), "bank"),
]
CATEGORIES = [
    (re.compile(r"аренд|ijara", re.I), "Аренда"),
    (re.compile(r"зарплат|oylik", re.I), "Зарплата"),
    (re.compile(r"налог|soliq", re.I), "Налоги"),
    (re.compile(r"кредит", re.I), "Кредит"),
    (re.compile(r"поставщик|заготовк|ткан|закуп|yetkazib|mato", re.I), "Поставщик"),
    (re.compile(r"реклам", re.I), "Реклама"),
    (re.compile(r"такси|бензин|проезд|taksi", re.I), "Транспорт"),
    (re.compile(r"кофе|обед|ужин|продукт|еда", re.I), "Питание"),
    (re.compile(r"коммунал|свет|газ|интернет", re.I), "Коммунальные"),
]


def _text(value, limit):
    return value.strip()[:limit] if isinstance(value, str) else ""


def _with_author(draft, created_by):
    """Автор черновика (id пользователя) — чтобы созданная из него операция принадлежала тому, кто говорил с ИИ."""
    if created_by is not None:
        draft["created_by"] = getattr(created_by, "pk", created_by)
    return draft


def validate_draft(business, raw, created_by=None):
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
    category = canonical_category(_text(raw.get("category"), 80) or "")
    if not category:
        return None
    purpose = raw.get("purpose") if raw.get("purpose") in PURPOSES else "unclear"
    draft = {
        "amount": amount, "direction": raw["direction"], "category": category, "purpose": purpose,
        "account_id": account_id, "date": today().isoformat(),
        "counterparty": _text(raw.get("counterparty"), 120), "note": _text(raw.get("note"), 300),
    }
    return _with_author(draft, created_by)


def _multiplier(word):
    return 10**6 if word.lower().startswith(("млн", "милл", "mln", "mill")) else 10**3


def parse_amount(text):
    """Первая сумма в сумах: «4 млн», «1 млн 200 тысяч», «полтора миллиона», «yigirma ming»; None, если нет."""
    text = re.sub("[’ʻʼ`‘]", "'", text)
    amount = None
    for match in WORD_AMOUNT.finditer(text):
        if match["half"]:
            value = 1.5 * (_multiplier(match["unit"]) if match["unit"] else 10**6) if match["half"].lower().startswith("полт") \
                else 0.5 * (_multiplier(match["unit"]) if match["unit"] else 10**6)
        else:
            tens = UZ_TENS[match["tens"].lower()] if match["tens"] else 0
            value = (tens + (UZ_ONES[match["ones"].lower()] if match["ones"] else 0)) * _multiplier(match["uzunit"])
        amount = int(value)
        break
    total, last_end, last_mult = 0, None, None
    for match in AMOUNT.finditer(text):
        whole, fraction, word = match.groups()
        value = float(re.sub(r"\s", "", whole) + ("." + fraction if fraction else ""))
        mult = _multiplier(word) if word else 1
        value *= mult
        joined = last_end is not None and last_mult and mult < last_mult and re.fullmatch(r"\s*(?:и\s*)?", text[last_end:match.start()])
        if joined:
            total += value
        elif total >= 1000:
            break
        elif value >= 1000:
            total = value
        else:
            continue
        last_end, last_mult = match.end(), mult
    digits = int(round(total)) if total >= 1000 else None
    return digits if digits is not None else amount


def parse_text_draft(business, text, created_by=None):
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
    draft = {
        "amount": amount, "direction": direction, "category": category, "purpose": purpose,
        "account_id": account.id, "date": today().isoformat(), "counterparty": "", "note": text.strip()[:300],
    }
    return _with_author(draft, created_by)
