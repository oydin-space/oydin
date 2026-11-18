"""Факты и инструменты для чата: модель видит только данные текущего бизнеса."""

from datetime import date, timedelta

from django.db.models import Sum

from finance import services as fin
from finance.models import Transaction

from . import categories, exa, memory, people_tools

MAX_TOOL_ROUNDS = 3


def _month_start(day, back=0):
    """Первое число месяца, отстоящего от day на back месяцев назад."""
    index = day.year * 12 + day.month - 1 - back
    return date(index // 12, index % 12 + 1, 1)


def _expenses_by_category(business, start, end):
    """Расходы бизнеса по категориям за период (без личных и изъятий), по убыванию."""
    out = fin.confirmed(business).filter(direction="out", date__gte=start, date__lte=end).exclude(
        purpose__in=[Transaction.Purpose.PERSONAL, Transaction.Purpose.OWNER_DRAW])
    cats = {}
    for row in out.order_by().values("category", "account__currency").annotate(s=Sum("amount")):
        cats[row["category"]] = cats.get(row["category"], 0) + fin.rows_to_uzs([row])
    return [{"category": k, "amount": v} for k, v in sorted(cats.items(), key=lambda kv: -kv[1])[:8]]


def month_summaries(business, months=2, now=None):
    """Календарные месяцы от текущего назад: итоги и расходы по категориям; текущий — по сегодня.
    Для честного сравнения у прошлых месяцев есть итоги за те же дни (1..сегодняшнее число)."""
    now = now or fin.today()
    result = []
    for back in range(months):
        start = _month_start(now, back)
        end = now if back == 0 else _month_start(now, back - 1) - timedelta(days=1)
        item = {"month": start.strftime("%Y-%m"), "from": start.isoformat(), "to": end.isoformat(),
                **fin.period_totals(business, start, end), "expenses_by_category": _expenses_by_category(business, start, end)}
        if back:
            same_end = min(end, start + timedelta(days=now.day - 1))
            item["same_days_as_current"] = {"to": same_end.isoformat(), **fin.period_totals(business, start, same_end)}
        result.append(item)
    return result


def build_facts(business, now=None, lang="ru"):
    now = now or fin.today()
    pulse = fin.pulse(business, now, lang)
    pulse.pop("metrics", None)
    month = fin.period_totals(business, now - timedelta(days=29), now)
    recent = fin.confirmed(business).order_by("-date", "-id")[:10]
    b = fin.bundle(business, 30, now)
    return categories.localize_data({
        "today": now.isoformat(),
        "tax_regime": business.tax_regime,
        "accounts": fin.list_accounts(business),
        "pulse": pulse,
        "last_30_days": month,
        "this_and_last_month": month_summaries(business, 2, now),
        "top_expenses_30d": fin.analytics(business, "month", now)["by_category"],
        "obligations": [
            {**o, "due_date": o["due_date"].isoformat()}
            for o in fin.obligation_dicts(business, b) if o["status"] != "paid"
        ],
        "envelopes": fin.envelopes(business, now),
        "recent_transactions": [fin.serialize_transaction(t, lang) for t in recent],
    }, lang)


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
    qs = fin.search_transactions(fin.confirmed(business), categories.canonical(q.strip())[:100])[: _int(args.get("limit"), 10, 1, 20)]
    return {"transactions": [fin.serialize_transaction(t) for t in qs]}


def get_analytics(business, args):
    period = args.get("period")
    return fin.analytics(business, period if period in fin.PERIOD_DAYS else "month")


def get_orders(business, args):
    return {"orders": fin.orders(business), "products": fin.products(business)}


def compare_months(business, args):
    return {"months": month_summaries(business, _int(args.get("months"), 2, 2, 6))}


TOOLS = {
    "get_forecast": (get_forecast, "days (7..90): остаток по дням"),
    "search_transactions": (search_transactions, "q: слово из заметки/контрагента/категории, limit"),
    "get_analytics": (get_analytics, "period: week|month|quarter — выручка, расходы, категории, недели"),
    "get_orders": (get_orders, "заказы и товары с маржой"),
    "compare_months": (compare_months, "months (2..6): календарные месяцы от текущего назад — выручка, расходы, прибыль, категории; same_days_as_current — те же дни прошлых месяцев для сравнения «этот vs прошлый»"),
}


def run_tool(business, name, args, lang="ru"):
    entry = TOOLS.get(name)
    if entry is None:
        return {"error": f"нет инструмента {name}"}
    return categories.localize_data(entry[0](business, args if isinstance(args, dict) else {}), lang)


TOOLS_HELP = "\n".join(f"- {name}: {desc}" for name, (_, desc) in TOOLS.items())


# Инструменты с контекстом запроса (пользователь, роль, язык): память и веб-поиск.
CONTEXT_TOOLS = {
    "remember": (memory.tool_remember, 'scope: "business"|"user", text: короткий факт, который стоит помнить (только по просьбе или явно полезный)'),
    "forget": (memory.tool_forget, "id: факт из памяти, который нужно забыть"),
    "get_context": (memory.tool_get_context, "профиль пользователя и бизнеса и вся память"),
    "list_people": (people_tools.tool_list_people, 'kind: staff|contractor|buyer|partner (необязательно): люди бизнеса и сводка по ним'),
    "add_person": (people_tools.tool_add_person, 'name, kind, pay_type (monthly|hourly|per_task|percent|none), pay_amount, currency, role_title, started_on (YYYY-MM-DD), note: НЕ создаёт человека, а возвращает черновик-карточку; пользователь сам нажимает «Подтвердить» в чате'),
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
