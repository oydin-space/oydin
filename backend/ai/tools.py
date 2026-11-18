"""Факты и инструменты для чата: модель видит только данные текущего бизнеса."""

from datetime import timedelta

from finance import services as fin

from . import exa, memory

MAX_TOOL_ROUNDS = 3


def build_facts(business, now=None):
    now = now or fin.today()
    pulse = fin.pulse(business, now)
    pulse.pop("metrics", None)
    month = fin.period_totals(business, now - timedelta(days=29), now)
    recent = fin.confirmed(business).order_by("-date", "-id")[:10]
    b = fin.bundle(business, 30, now)
    return {
        "today": now.isoformat(),
        "tax_regime": business.tax_regime,
        "accounts": fin.list_accounts(business),
        "pulse": pulse,
        "last_30_days": month,
        "top_expenses_30d": fin.analytics(business, "month", now)["by_category"],
        "obligations": [
            {**o, "due_date": o["due_date"].isoformat()}
            for o in fin.obligation_dicts(business, b) if o["status"] != "paid"
        ],
        "envelopes": fin.envelopes(business, now),
        "recent_transactions": [fin.serialize_transaction(t) for t in recent],
    }


def _int(value, default, low, high):
    try:
        return max(low, min(high, int(value)))
    except (TypeError, ValueError):
        return default


def get_forecast(business, args):
    return {"points": fin.forecast_points(business, _int(args.get("days"), 30, 7, 90))}


def search_transactions(business, args):
    q = args.get("q")
    if not isinstance(q, str) or not q.strip():
        return {"error": "q обязателен"}
    qs = fin.search_transactions(fin.confirmed(business), q[:100])[: _int(args.get("limit"), 10, 1, 20)]
    return {"transactions": [fin.serialize_transaction(t) for t in qs]}


def get_analytics(business, args):
    period = args.get("period")
    return fin.analytics(business, period if period in fin.PERIOD_DAYS else "month")


def get_orders(business, args):
    return {"orders": fin.orders(business), "products": fin.products(business)}


TOOLS = {
    "get_forecast": (get_forecast, "days (7..90): остаток по дням"),
    "search_transactions": (search_transactions, "q: слово из заметки/контрагента/категории, limit"),
    "get_analytics": (get_analytics, "period: week|month|quarter — выручка, расходы, категории, недели"),
    "get_orders": (get_orders, "заказы и товары с маржой"),
}


def run_tool(business, name, args):
    entry = TOOLS.get(name)
    if entry is None:
        return {"error": f"нет инструмента {name}"}
    return entry[0](business, args if isinstance(args, dict) else {})


TOOLS_HELP = "\n".join(f"- {name}: {desc}" for name, (_, desc) in TOOLS.items())


# Инструменты с контекстом запроса (пользователь, роль, язык): память и веб-поиск.
CONTEXT_TOOLS = {
    "remember": (memory.tool_remember, 'scope: "business"|"user", text: короткий факт, который стоит помнить (только по просьбе или явно полезный)'),
    "forget": (memory.tool_forget, "id: факт из памяти, который нужно забыть"),
    "get_context": (memory.tool_get_context, "профиль пользователя и бизнеса и вся память"),
    "web_search": (exa.tool_web_search, "query: поиск в интернете, вернёт ссылки; называй url источников"),
    "research": (exa.tool_research, "query: исследование с готовым ответом и источниками; называй url"),
}
WEB_TOOLS = {"web_search", "research"}


def available_context_tools():
    return {n: e for n, e in CONTEXT_TOOLS.items() if n not in WEB_TOOLS or exa.is_enabled()}


def tools_help():
    lines = [TOOLS_HELP] + [f"- {name}: {desc}" for name, (_, desc) in available_context_tools().items()]
    return "\n".join(lines)


def run_context_tool(business, name, args, user, role, lang=None):
    entry = available_context_tools().get(name)
    if entry is None:
        return {"error": f"нет инструмента {name}"}
    return entry[0](business, args if isinstance(args, dict) else {}, user, role, lang)
