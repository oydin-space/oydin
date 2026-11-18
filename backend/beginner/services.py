from decimal import Decimal, InvalidOperation

from accounts.http import ApiError

from .models import BeginnerPlan
from .reference import CHECKLIST, FORMS

MAX_AMOUNT = 10**12
MAX_ITEMS = 100
KINDS = ("one_off", "monthly")


def _amount(raw, label, required=True):
    if raw in (None, ""):
        if required:
            raise ApiError(400, f"{label}: укажите сумму")
        return None
    try:
        value = Decimal(str(raw).strip())
    except InvalidOperation:
        raise ApiError(400, f"{label}: некорректная сумма")
    if not value.is_finite() or value < 0 or value > MAX_AMOUNT:
        raise ApiError(400, f"{label}: сумма вне допустимых пределов")
    return int(value.to_integral_value())


def clean_items(raw):
    if not isinstance(raw, list) or len(raw) > MAX_ITEMS:
        raise ApiError(400, "budget_items: ожидается список до 100 строк")
    out = []
    for row in raw:
        if not isinstance(row, dict):
            raise ApiError(400, "budget_items: некорректная строка")
        name = str(row.get("name", "")).strip()
        if not name or len(name) > 120:
            raise ApiError(400, "budget_items: название от 1 до 120 символов")
        kind = row.get("kind")
        if kind not in KINDS:
            raise ApiError(400, "budget_items: kind — one_off или monthly")
        out.append({"name": name, "kind": kind, "amount": _amount(row.get("amount"), name)})
    return out


def clean_breakeven(raw):
    if not isinstance(raw, dict):
        raise ApiError(400, "breakeven: ожидается объект")
    return {
        "price": _amount(raw.get("price"), "Цена", required=False),
        "unit_cost": _amount(raw.get("unit_cost"), "Себестоимость", required=False),
        "fixed_monthly": _amount(raw.get("fixed_monthly"), "Постоянные расходы", required=False),
    }


def clean_checklist(raw):
    if not isinstance(raw, list) or any(x not in CHECKLIST for x in raw):
        raise ApiError(400, "checklist: неизвестный шаг")
    return [x for x in CHECKLIST if x in raw]


def totals(items):
    one_off = sum(i["amount"] for i in items if i["kind"] == "one_off")
    monthly = sum(i["amount"] for i in items if i["kind"] == "monthly")
    return {"one_off": one_off, "monthly": monthly}


def break_even(b):
    """Точка безубыточности: единиц = постоянные / (цена − переменные). None, если данных нет или маржа ≤ 0."""
    price, cost, fixed = b.get("price"), b.get("unit_cost"), b.get("fixed_monthly")
    if price is None or cost is None or fixed is None:
        return {"margin": None, "units": None, "revenue": None}
    margin = price - cost
    if margin <= 0:
        return {"margin": margin, "units": None, "revenue": None}
    units = -(-fixed // margin)
    return {"margin": margin, "units": units, "revenue": units * price}


def get_plan(business):
    plan, _ = BeginnerPlan.objects.get_or_create(
        business=business, defaults={"breakeven": {"price": None, "unit_cost": None, "fixed_monthly": None}}
    )
    return plan


def serialize(plan):
    return {
        "budget_items": plan.budget_items,
        "totals": totals(plan.budget_items),
        "breakeven": plan.breakeven,
        "breakeven_result": break_even(plan.breakeven),
        "checklist": plan.checklist,
        "regime": plan.regime,
        "updated_at": plan.updated_at.isoformat(),
    }


def apply(plan, body):
    if "budget_items" in body:
        plan.budget_items = clean_items(body["budget_items"])
    if "breakeven" in body:
        plan.breakeven = clean_breakeven(body["breakeven"])
    if "checklist" in body:
        plan.checklist = clean_checklist(body["checklist"])
    if "regime" in body:
        if body["regime"] not in ("", *FORMS):
            raise ApiError(400, "regime: неизвестная форма")
        plan.regime = body["regime"]
    plan.save()
    return plan
