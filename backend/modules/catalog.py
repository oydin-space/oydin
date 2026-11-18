"""Каталог разрешённого: модули, пресеты, виджеты и допустимые поля спецификации.
Виджет читает данные только через API; произвольных таблиц и полей нет."""

from accounts.http import ApiError

MODULE_KEYS = ("money", "debts", "people", "suppliers", "warehouse", "schedules")

PRESETS = {
    "shop": ("money", "debts", "people", "suppliers", "warehouse"),
    "services": ("money", "debts", "people", "schedules"),
    "creator": ("money", "debts", "suppliers"),
    "cafe": ("money", "debts", "people", "suppliers", "warehouse", "schedules"),
}
# Пока владелец ничего не выбрал: деньги, долги и расчёты с поставщиками — ядро.
DEFAULT_MODULES = ("money", "debts", "people", "suppliers")

# Виджеты: ключ -> (модуль, спецификация по умолчанию).
WIDGETS = {
    "money_summary": ("money", {"type": "metric", "source": "money", "metric": "balance", "period": "30d", "size": "m"}),
    "debts_due": ("debts", {"type": "list", "source": "debts", "metric": "due", "limit": 5, "size": "m"}),
    "people_cost": ("people", {"type": "metric", "source": "people", "metric": "monthly_cost", "period": "30d", "size": "s"}),
    "suppliers_due": ("suppliers", {"type": "list", "source": "suppliers", "metric": "due", "limit": 5, "size": "m"}),
    "stock_low": ("warehouse", {"type": "list", "source": "warehouse", "metric": "low_stock", "limit": 5, "size": "m"}),
    "schedule_week": ("schedules", {"type": "list", "source": "schedules", "metric": "upcoming", "limit": 5, "size": "m"}),
}

TYPES = ("metric", "list", "chart")
SOURCES = {
    "money": ("balance", "income", "expense"),
    "debts": ("due", "overdue"),
    "people": ("monthly_cost", "headcount"),
    "suppliers": ("due", "overdue"),
    "warehouse": ("low_stock",),
    "schedules": ("upcoming",),
}
PERIODS = ("7d", "30d", "90d")
SIZES = ("s", "m", "l")
ALLOWED_KEYS = ("type", "source", "metric", "period", "title", "limit", "size")
USAGE_ACTIONS = ("view", "open", "dismiss", "resize")


def validate_spec(spec):
    """Возвращает очищенную спецификацию или бросает ApiError(400). Лишние ключи — ошибка."""
    if not isinstance(spec, dict):
        raise ApiError(400, "Спецификация должна быть объектом")
    extra = sorted(set(spec) - set(ALLOWED_KEYS))
    if extra:
        raise ApiError(400, f"Недопустимые поля: {', '.join(extra)}")
    if spec.get("type") not in TYPES:
        raise ApiError(400, "Недопустимый type")
    source = spec.get("source")
    if source not in SOURCES:
        raise ApiError(400, "Недопустимый source")
    if spec.get("metric") not in SOURCES[source]:
        raise ApiError(400, "Недопустимый metric")
    if "period" in spec and spec["period"] not in PERIODS:
        raise ApiError(400, "Недопустимый period")
    if "size" in spec and spec["size"] not in SIZES:
        raise ApiError(400, "Недопустимый size")
    if "limit" in spec:
        limit = spec["limit"]
        if isinstance(limit, bool) or not isinstance(limit, int) or not 1 <= limit <= 10:
            raise ApiError(400, "limit: целое от 1 до 10")
    if "title" in spec:
        title = spec["title"]
        if not isinstance(title, str) or not 1 <= len(title.strip()) <= 60:
            raise ApiError(400, "title: от 1 до 60 символов")
    return dict(spec)
