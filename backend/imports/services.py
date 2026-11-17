"""Сценарии импорта: строки файла → черновики с проверкой, дубликатами и сохранением."""

import hashlib
import re
from datetime import date, datetime
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.db import transaction as db_transaction

from accounts.http import ApiError
from finance.models import Account, Transaction

from . import mapping as mp
from . import parsers
from .models import ImportJob, ImportMapping

PREVIEW_ROWS = 50
MAX_AMOUNT = 10**13
DEFAULT_CATEGORY = "Импорт"
DATE_FORMATS = ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y", "%d-%m-%Y", "%Y/%m/%d", "%Y.%m.%d", "%d.%m.%y")
IN_WORDS = {"in", "income", "приход", "доход", "поступление", "kirim", "credit", "кредит", "+"}
OUT_WORDS = {"out", "expense", "расход", "списание", "chiqim", "debit", "дебет", "-"}


def parse_date(value):
    text = re.split(r"[ T]", value.strip(), maxsplit=1)[0]
    for fmt in DATE_FORMATS:
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def parse_amount(value):
    """Сумма как Decimal (со знаком) или None. Понимает «1 500 000,50», «1,500,000.00», «(250)»."""
    text = re.sub(r"[\s\u00a0\u202f]", "", value or "")
    text = re.sub(r"(?i)(сум|сўм|so'm|uzs)$", "", text)
    negative = text.startswith("-") or (text.startswith("(") and text.endswith(")"))
    text = text.strip("-+()")
    if not re.fullmatch(r"[\d.,]+", text):
        return None
    if "," in text and "." in text:
        decimal = "," if text.rfind(",") > text.rfind(".") else "."
        thousands = "." if decimal == "," else ","
        text = text.replace(thousands, "").replace(decimal, ".")
    elif text.count(",") > 1 or text.count(".") > 1:
        text = text.replace(",", "").replace(".", "")
    elif "," in text:
        head, tail = text.split(",")
        text = head + tail if len(tail) == 3 and 1 <= len(head) <= 3 else head + "." + tail
    try:
        value = Decimal(text)
    except InvalidOperation:
        return None
    return -value if negative else value


def dedupe_key(day, amount, counterparty, account_id):
    raw = f"{day.isoformat()}|{amount}|{(counterparty or '').strip().lower()}|{account_id}"
    return hashlib.sha1(raw.encode()).hexdigest()


def direction_of(value):
    low = (value or "").strip().lower()
    return "in" if low in IN_WORDS else "out" if low in OUT_WORDS else None


def default_account(business, job):
    return job.account or Account.objects.filter(business=business).first()


def build_rows(job):
    """Все строки файла по текущему маппингу: row, draft, duplicate, errors (+ key для сравнения)."""
    business = job.business
    col = {}
    for name, field in job.mapping.items():
        col.setdefault(field, name)
    accounts = {a.name.strip().lower(): a for a in Account.objects.filter(business=business)}
    fallback = default_account(business, job)
    out = []
    for index, raw in enumerate(job.rows, 1):
        get = lambda f: raw.get(col[f], "").strip() if f in col else ""  # noqa: E731
        errors = []
        day = parse_date(get("date"))
        if day is None:
            errors.append("date")
        amount, direction = None, None
        if "amount" in col:
            value = parse_amount(get("amount"))
            if value is None:
                errors.append("amount")
            else:
                direction = direction_of(get("direction")) or ("out" if value < 0 else "in")
                if "direction" in col and get("direction") and direction_of(get("direction")) is None:
                    errors.append("direction")
                amount = abs(value)
        else:
            inflow, outflow = parse_amount(get("inflow")), parse_amount(get("outflow"))
            if inflow and inflow != 0:
                amount, direction = abs(inflow), "in"
            elif outflow and outflow != 0:
                amount, direction = abs(outflow), "out"
            else:
                errors.append("amount")
        if amount is not None:
            amount = int(amount.quantize(Decimal(1), rounding=ROUND_HALF_UP))
            if not 1 <= amount <= MAX_AMOUNT:
                errors.append("amount")
        if direction is None and "direction" not in errors and "amount" not in errors:
            errors.append("direction")
        account = accounts.get(get("account").lower()) if get("account") else None
        account = account or fallback
        if account is None:
            errors.append("account")
        counterparty = get("counterparty")[:200] or None
        draft = {
            "date": day.isoformat() if day else None,
            "amount": amount if "amount" not in errors else None,
            "direction": direction,
            "category": get("category")[:100] or DEFAULT_CATEGORY,
            "purpose": "business",
            "account_id": account.id if account else None,
            "counterparty": counterparty,
            "note": get("note"),
        }
        key = None
        if not errors:
            key = dedupe_key(day, amount, counterparty, account.id)
        out.append({"row": index, "draft": draft, "duplicate": False, "errors": sorted(set(errors)), "key": key})
    mark_duplicates(business, out)
    return out


def mark_duplicates(business, rows):
    days = [date.fromisoformat(r["draft"]["date"]) for r in rows if r["key"]]
    if not days:
        return
    existing = {
        dedupe_key(d, a, c, acc)
        for d, a, c, acc in Transaction.objects.filter(
            business=business, date__gte=min(days), date__lte=max(days)
        ).values_list("date", "amount", "counterparty", "account_id")
    }
    for r in rows:
        r["duplicate"] = r["key"] in existing


def serialize(job, rows=None):
    rows = build_rows(job) if rows is None and job.status == ImportJob.Status.PREVIEW else rows or []
    return {
        "id": job.id, "kind": job.kind, "filename": job.filename, "status": job.status,
        "mapping": job.mapping, "mapping_confidence": job.mapping_confidence, "columns": job.columns,
        "total_rows": len(job.rows),
        "preview": [{k: r[k] for k in ("row", "draft", "duplicate", "errors")} for r in rows[:PREVIEW_ROWS]],
        "created_count": job.created_count,
    }


def create_job(business, user, filename, data, kind, account):
    if len(data) > parsers.MAX_BYTES:
        raise ApiError(413, "file_too_large")
    kind = kind or parsers.detect_kind(filename, data)
    columns, rows = parsers.PARSERS[kind](data)
    if kind in parsers.FIXED_KINDS:
        mapping, confidence = dict(parsers.FIXED_MAPPING), 1.0
    else:
        mapping, confidence = mp.propose(business, user, columns, rows)
    return ImportJob.objects.create(
        business=business, created_by=user, kind=kind, filename=filename[:255], columns=columns, rows=rows,
        mapping=mapping, mapping_confidence=confidence, signature=mp.signature(columns), account=account,
    )


def update_mapping(job, new_mapping):
    cleaned = mp.clean(job.columns, new_mapping)
    if cleaned is None or not mp.has_required(cleaned):
        raise ApiError(400, "invalid_mapping")
    job.mapping, job.mapping_confidence = cleaned, 1.0


@db_transaction.atomic
def commit(job, user, *, skip_duplicates=True, exclude_rows=()):
    rows = build_rows(job)
    excluded = set(exclude_rows)
    drafts = []
    for r in rows:
        if r["errors"] or r["row"] in excluded or (skip_duplicates and r["duplicate"]):
            continue
        d = r["draft"]
        drafts.append(Transaction(
            business=job.business, account_id=d["account_id"], date=date.fromisoformat(d["date"]), amount=d["amount"],
            direction=d["direction"], category=d["category"], purpose=d["purpose"], counterparty=d["counterparty"],
            note=d["note"], status=Transaction.Status.DRAFT, source=Transaction.Source.IMPORT, created_by=user,
        ))
    Transaction.objects.bulk_create(drafts)
    if job.kind not in parsers.FIXED_KINDS:
        ImportMapping.objects.update_or_create(
            business=job.business, signature=job.signature, defaults={"mapping": job.mapping}
        )
    job.status, job.created_count = ImportJob.Status.COMMITTED, len(drafts)
    job.save(update_fields=["status", "created_count"])
    return rows
