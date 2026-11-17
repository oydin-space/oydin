"""Встроенные калькуляторы: детерминированные спецификации OpenUI Lang, заполненные данными бизнеса.

Работают без модели; модель только подстраивает их под просьбу. Налоговых калькуляторов нет намеренно.
"""

import json
import re
from datetime import date, timedelta

from finance import services as fin

KINDS = ["what_if_gap", "unit_cost", "break_even", "payroll", "loan", "envelope_plan_fact", "receivables_aging"]
ALL_KINDS = [*KINDS, "custom"]
LANGS = ("ru", "uz", "en")
TAX_RE = re.compile(r"налог|ндс|soliq|qqs|\btax|\bvat\b", re.I)
KEYWORDS = [
    ("loan", r"кредит|займ|заём|рассрочк|kredit|qarz ol|loan|credit"),
    ("payroll", r"зарплат|фот|оклад|maosh|ish haqi|payroll|salar"),
    ("break_even", r"безубыт|точк\w* окуп|zararsiz|break.?even"),
    ("unit_cost", r"себестоим|за единиц|tannarx|unit cost|cost per"),
    ("receivables_aging", r"дебитор|должник|долг\w* клиент|debitor|qarzdor|receivab|debtor"),
    ("envelope_plan_fact", r"конверт|план.?факт|копил|jamg|envelope|plan.?fact|saving"),
    ("what_if_gap", r"разрыв|что если|задерж|хватит|uzilish|agar|gap|what if|runway"),
]

# Тексты: ключ → (ru, uz, en)
T = {
    "what_if_gap": ("Что если: кассовый разрыв", "Agar bo'lsa: kassa uzilishi", "What if: cash gap"),
    "unit_cost": ("Себестоимость единицы", "Birlik tannarxi", "Unit cost"),
    "break_even": ("Точка безубыточности", "Zararsizlik nuqtasi", "Break-even point"),
    "payroll": ("Фонд зарплаты", "Ish haqi fondi", "Payroll"),
    "loan": ("Кредит: платёж и переплата", "Kredit: to'lov va ortiqcha to'lov", "Loan: payment and interest"),
    "envelope_plan_fact": ("Конверт: план и факт", "Konvert: reja va fakt", "Envelope: plan vs actual"),
    "receivables_aging": ("Дебиторка по срокам", "Debitorlik muddatlar bo'yicha", "Receivables aging"),
    "balance": ("Сейчас на счетах", "Hozir hisoblarda", "Balance now"),
    "income30": ("Поступления за 30 дней", "30 kunlik tushum", "Income per 30 days"),
    "expense30": ("Расходы за 30 дней", "30 kunlik xarajat", "Expenses per 30 days"),
    "extra": ("Разовый расход", "Bir martalik xarajat", "One-off expense"),
    "delay": ("Задержка поступлений", "Tushum kechikishi", "Income delay"),
    "days": ("дней", "kun", "days"),
    "left30": ("Останется через 30 дней", "30 kundan keyin qoladi", "Left in 30 days"),
    "runway": ("Хватит денег на", "Pul yetadi", "Cash lasts"),
    "materials": ("Материалы на партию", "Partiya uchun xomashyo", "Materials per batch"),
    "labor": ("Работа на партию", "Partiya uchun ish haqi", "Labor per batch"),
    "overhead": ("Накладные на партию", "Partiya uchun ustama", "Overhead per batch"),
    "units": ("Единиц в партии", "Partiyadagi birliklar", "Units per batch"),
    "pcs": ("шт.", "dona", "pcs"),
    "markup": ("Наценка", "Ustama", "Markup"),
    "cost_unit": ("Себестоимость единицы", "Birlik tannarxi", "Cost per unit"),
    "price_unit": ("Цена с наценкой", "Ustamali narx", "Price with markup"),
    "profit_unit": ("Прибыль с единицы", "Birlikdan foyda", "Profit per unit"),
    "fixed": ("Постоянные расходы в месяц", "Oylik doimiy xarajatlar", "Fixed costs per month"),
    "price": ("Цена единицы", "Birlik narxi", "Price per unit"),
    "variable": ("Переменные затраты на единицу", "Birlikka o'zgaruvchan xarajat", "Variable cost per unit"),
    "be_units": ("Продать в месяц, шт.", "Oyiga sotish kerak, dona", "Units to sell per month"),
    "be_revenue": ("Выручка для безубыточности", "Zararsizlik uchun tushum", "Break-even revenue"),
    "margin": ("Маржа с единицы", "Birlik marjasi", "Margin per unit"),
    "people": ("Сотрудников", "Xodimlar", "Employees"),
    "people_unit": ("чел.", "kishi", "people"),
    "salary": ("Оклад одного", "Bir kishi maoshi", "Salary per person"),
    "bonus": ("Премия", "Mukofot", "Bonus"),
    "revenue30": ("Выручка за месяц", "Oylik tushum", "Monthly revenue"),
    "payroll_total": ("Фонд зарплаты в месяц", "Oylik ish haqi fondi", "Monthly payroll"),
    "payroll_share": ("Доля от выручки", "Tushumdagi ulushi", "Share of revenue"),
    "loan_amount": ("Сумма кредита", "Kredit summasi", "Loan amount"),
    "rate": ("Ставка, % годовых", "Stavka, yillik %", "Rate, % per year"),
    "months": ("Срок", "Muddat", "Term"),
    "months_unit": ("мес.", "oy", "months"),
    "first_payment": ("Первый платёж", "Birinchi to'lov", "First payment"),
    "avg_payment": ("Средний платёж", "O'rtacha to'lov", "Average payment"),
    "overpay": ("Переплата", "Ortiqcha to'lov", "Total interest"),
    "loan_note": ("Дифференцированные платежи: долг гасится равными частями.", "Tabaqalashtirilgan to'lovlar: qarz teng qismlarda so'ndiriladi.", "Declining payments: principal is repaid in equal parts."),
    "plan": ("План", "Reja", "Plan"),
    "fact": ("Отложено", "Yig'ilgan", "Saved"),
    "days_left": ("Дней до срока", "Muddatgacha kun", "Days to deadline"),
    "remaining": ("Осталось отложить", "Yig'ish qoldi", "Left to save"),
    "per_day": ("Откладывать в день", "Kuniga yig'ish", "Save per day"),
    "done_pct": ("Выполнено", "Bajarildi", "Done"),
    "b0": ("Не просрочено и до 30 дней", "Muddati o'tmagan va 30 kungacha", "Current and up to 30 days"),
    "b1": ("31–60 дней", "31–60 kun", "31–60 days"),
    "b2": ("61–90 дней", "61–90 kun", "61–90 days"),
    "b3": ("Больше 90 дней", "90 kundan ortiq", "Over 90 days"),
    "recover": ("Вернётся из долгов 90+", "90+ qarzlardan qaytadi", "Recovered from 90+ debts"),
    "ar_total": ("Всего должны вам", "Sizga jami qarz", "Total owed to you"),
    "ar_overdue": ("Доля просрочки 30+", "30+ muddati o'tgan ulush", "Overdue 30+ share"),
    "ar_expected": ("Ожидаемо соберёте", "Kutilgan yig'im", "Expected to collect"),
}


def tr(key, lang):
    return T[key][LANGS.index(lang) if lang in LANGS else 0]


def s(text):
    return json.dumps(text, ensure_ascii=False)


def spec(lang, title, inputs, outputs, note=None):
    """Собирает OpenUI Lang: root = Stack([calc]); inputs: (тип, name, label_key, *числа[, unit_key]); outputs: (label_key, формула, формат)."""
    lines, refs_in, refs_out = [], [], []
    for i, (kind, name, label, *rest) in enumerate(inputs):
        args = [s(name), s(tr(label, lang))]
        for v in rest:
            args.append(s(tr(v, lang)) if isinstance(v, str) else str(int(v) if float(v).is_integer() else v))
        lines.append(f"i{i} = {kind}({', '.join(args)})")
        refs_in.append(f"i{i}")
    for i, (label, formula, fmt) in enumerate(outputs):
        lines.append(f"o{i} = Output({s(tr(label, lang))}, {s(formula)}, {s(fmt)})")
        refs_out.append(f"o{i}")
    calc_args = [s(title), f"[{', '.join(refs_in)}]", f"[{', '.join(refs_out)}]"] + ([s(tr(note, lang))] if note else [])
    return "\n".join(["root = Stack([calc])", f"calc = Calculator({', '.join(calc_args)})", *lines])


def _month(business):
    now = fin.today()
    return fin.period_totals(business, now - timedelta(days=29), now)


def build(kind, business, lang="ru"):
    """{title, kind, spec} для встроенного вида; KeyError для неизвестного."""
    title = tr(kind, lang)
    if kind == "what_if_gap":
        month = _month(business)
        balance = sum(a["balance_uzs"] for a in fin.list_accounts(business))
        body = spec(lang, title, [
            ("MoneyField", "balance", "balance", balance),
            ("MoneyField", "income", "income30", month["revenue"]),
            ("MoneyField", "expense", "expense30", month["expenses"]),
            ("MoneyField", "extra", "extra", 0),
            ("SliderField", "delay", "delay", 0, 0, 30, 1),
        ], [
            ("left30", "balance + income * (30 - delay) / 30 - expense - extra", "money"),
            ("runway", "round(max(0, balance - extra) / max(expense / 30, 1))", "days"),
        ])
    elif kind == "unit_cost":
        body = spec(lang, title, [
            ("MoneyField", "materials", "materials", 0), ("MoneyField", "labor", "labor", 0),
            ("MoneyField", "overhead", "overhead", 0), ("NumberField", "units", "units", 100, "pcs"),
            ("SliderField", "markup", "markup", 30, 0, 200, 5),
        ], [
            ("cost_unit", "(materials + labor + overhead) / max(units, 1)", "money"),
            ("price_unit", "(materials + labor + overhead) / max(units, 1) * (1 + markup / 100)", "money"),
            ("profit_unit", "(materials + labor + overhead) / max(units, 1) * markup / 100", "money"),
        ])
    elif kind == "break_even":
        body = spec(lang, title, [
            ("MoneyField", "fixed", "fixed", _month(business)["expenses"]),
            ("MoneyField", "price", "price", 0), ("MoneyField", "variable", "variable", 0),
        ], [
            ("be_units", "round(fixed / max(price - variable, 1))", "number"),
            ("be_revenue", "round(fixed / max(price - variable, 1)) * price", "money"),
            ("margin", "price - variable", "money"),
        ])
    elif kind == "payroll":
        body = spec(lang, title, [
            ("NumberField", "people", "people", 1, "people_unit"), ("MoneyField", "salary", "salary", 0),
            ("SliderField", "bonus", "bonus", 0, 0, 100, 5),
            ("MoneyField", "revenue", "revenue30", _month(business)["revenue"]),
        ], [
            ("payroll_total", "people * salary * (1 + bonus / 100)", "money"),
            ("payroll_share", "people * salary * (1 + bonus / 100) / max(revenue, 1) * 100", "percent"),
        ])
    elif kind == "loan":
        body = spec(lang, title, [
            ("MoneyField", "amount", "loan_amount", 0), ("SliderField", "rate", "rate", 24, 0, 60, 1),
            ("SliderField", "months", "months", 12, 1, 60, 1),
        ], [
            ("first_payment", "amount / max(months, 1) + amount * rate / 1200", "money"),
            ("avg_payment", "amount / max(months, 1) + amount * rate / 1200 * (months + 1) / (2 * max(months, 1))", "money"),
            ("overpay", "amount * rate / 1200 * (months + 1) / 2", "money"),
        ], note="loan_note")
    elif kind == "envelope_plan_fact":
        envs = fin.envelopes(business, fin.today())
        env = envs[0] if envs else None
        if env:
            days = max(1, (date.fromisoformat(env["due_date"]) - fin.today()).days)
            title = f"{title}: {env['title']}"
        body = spec(lang, title, [
            ("MoneyField", "plan", "plan", env["target"] if env else 0),
            ("MoneyField", "fact", "fact", env["saved"] if env else 0),
            ("NumberField", "days", "days_left", days if env else 30, "days"),
        ], [
            ("remaining", "max(plan - fact, 0)", "money"),
            ("per_day", "max(plan - fact, 0) / max(days, 1)", "money"),
            ("done_pct", "min(fact / max(plan, 1) * 100, 100)", "percent"),
        ])
    elif kind == "receivables_aging":
        from planning.services import debtors
        buckets = [0, 0, 0, 0]
        for d in debtors(business):
            days = d["overdue_days"]
            buckets[0 if days <= 30 else 1 if days <= 60 else 2 if days <= 90 else 3] += d["balance"]
        body = spec(lang, title, [
            *[("MoneyField", f"b{i}", f"b{i}", v) for i, v in enumerate(buckets)],
            ("SliderField", "recover", "recover", 50, 0, 100, 5),
        ], [
            ("ar_total", "b0 + b1 + b2 + b3", "money"),
            ("ar_overdue", "(b1 + b2 + b3) / max(b0 + b1 + b2 + b3, 1) * 100", "percent"),
            ("ar_expected", "b0 + b1 + b2 + b3 * recover / 100", "money"),
        ])
    else:
        raise KeyError(kind)
    return {"title": title, "kind": kind, "spec": body}


def infer_kind(prompt):
    for kind, pattern in KEYWORDS:
        if re.search(pattern, prompt or "", re.I):
            return kind
    return "custom"


def is_tax(kind, prompt):
    return bool(TAX_RE.search(kind or "")) or bool(TAX_RE.search(prompt or ""))
