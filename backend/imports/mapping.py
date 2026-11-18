"""Маппинг колонок файла в поля операции: память бизнеса → AI → эвристика по заголовкам ru/uz/en."""

import hashlib
import logging

from django.conf import settings

logger = logging.getLogger(__name__)

FIELDS = ["date", "amount", "inflow", "outflow", "direction", "category", "counterparty", "note", "account", "currency", "skip"]

# Порядок важен: «Сумма прихода» должна стать inflow, а не amount.
KEYWORDS = [
    ("inflow", ("приход", "доход", "поступлен", "income", "credit", "кредит", "kirim", "received")),
    ("outflow", ("расход", "списан", "дебет", "debit", "expense", "chiqim", "spent")),
    ("date", ("дата", "date", "sana", "data", "день")),
    ("direction", ("тип", "направлен", "вид операц", "type", "direction", "turi", "yo'nalish", "yoʻnalish", "yonalish")),
    ("amount", ("сумма", "сумм", "итого", "amount", "total", "summa", "sum", "miqdor", "narx", "стоимость")),
    ("category", ("категор", "статья", "category", "kategoriya", "toifa")),
    ("counterparty", ("контрагент", "клиент", "покупатель", "поставщик", "получатель", "плательщик", "counterparty", "customer", "client", "supplier", "kontragent", "mijoz", "taminotchi", "ta'minotchi", "taʼminotchi")),
    ("note", ("назначен", "комментар", "примечан", "описан", "note", "comment", "description", "memo", "izoh", "tavsif")),
    ("account", ("счёт", "счет", "касса", "account", "hisob", "kassa")),
    ("currency", ("валют", "currency", "valyuta")),
]


def signature(columns):
    norm = "|".join(sorted(c.strip().lower() for c in columns))
    return hashlib.sha1(norm.encode()).hexdigest()


def heuristic(columns):
    mapping, used = {}, set()
    for col in columns:
        low = col.lower()
        mapping[col] = "skip"
        for field, words in KEYWORDS:
            if field not in used and any(w in low for w in words):
                mapping[col], _ = field, used.add(field)
                break
    return mapping, confidence(columns, mapping)


def has_required(mapping):
    values = set(mapping.values())
    return "date" in values and ("amount" in values or {"inflow", "outflow"} & values)


def confidence(columns, mapping):
    if not has_required(mapping):
        return 0.0
    mapped = sum(1 for c in columns if mapping.get(c, "skip") != "skip")
    return round(0.6 + 0.4 * mapped / len(columns), 2)


def clean(columns, mapping):
    """Только известные колонки и поля; иначе None."""
    if not isinstance(mapping, dict):
        return None
    out = {c: mapping.get(c, "skip") for c in columns}
    return out if all(v in FIELDS for v in out.values()) else None


SYSTEM = (
    "Ты сопоставляешь колонки таблицы операций малого бизнеса (русский/узбекский/английский заголовки) с полями: "
    + ", ".join(FIELDS)
    + '. inflow/outflow — отдельные колонки прихода/расхода; skip — лишняя колонка. '
    'Ответь JSON: {"mapping": {"<колонка>": "<поле>"}, "confidence": 0..1}.'
)


def ai_mapping(user, columns, rows):
    from accounts.consent import has_consent
    from ai import llm

    if not llm.is_configured() or not has_consent(user, "ai"):
        return None
    sample = [{c: r.get(c, "") for c in columns} for r in rows[:3]]
    try:
        reply = llm.complete(
            SYSTEM, [{"role": "user", "content": f"Колонки: {columns}\nПримеры строк: {sample}"}],
            timeout=20, name="import_mapping", temperature=0, model=settings.LLM_CLASSIFY_MODEL,
        )
    except Exception:  # провайдер недоступен — работает эвристика
        logger.warning("import mapping LLM failed", exc_info=True)
        return None
    mapping = clean(columns, reply.get("mapping") if isinstance(reply, dict) else None)
    if mapping is None or not has_required(mapping):
        return None
    try:
        conf = max(0.0, min(1.0, float(reply.get("confidence", 0.8))))
    except (TypeError, ValueError):
        conf = 0.8
    return mapping, round(conf, 2)


def propose(business, user, columns, rows):
    from .models import ImportMapping

    sig = signature(columns)
    saved = ImportMapping.objects.filter(business=business, signature=sig).first()
    if saved and (m := clean(columns, saved.mapping)) and has_required(m):
        return m, 1.0
    return ai_mapping(user, columns, rows) or heuristic(columns)
