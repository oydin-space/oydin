"""Человекочитаемые тексты планирования на ru / uz (латиница) / en."""

LANGS = ("ru", "uz", "en")


def resolve_lang(request, body=None):
    """lang из тела запроса или ?lang=, затем Accept-Language; неизвестное -> ru."""
    raw = (body or {}).get("lang") if isinstance(body, dict) else None
    raw = raw or request.GET.get("lang")
    if not raw:
        raw = request.headers.get("Accept-Language", "").split(",")[0]
    raw = str(raw).strip().lower().replace("_", "-").split("-")[0]
    return raw if raw in LANGS else "ru"


def money(amount, lang):
    n = abs(int(amount))
    if n >= 1_000_000:
        value = n / 1_000_000
        num = f"{value:.0f}" if value >= 10 else f"{value:.1f}".rstrip("0").rstrip(".")
        if lang == "en":
            text = num + "M"
        else:
            text = num.replace(".", ",") + (" млн" if lang == "ru" else " mln")
    elif n >= 1000:
        k = round(n / 1000)
        text = {"ru": f"{k} тыс.", "uz": f"{k} ming", "en": f"{k}K"}[lang]
    else:
        text = f"{n} " + {"ru": "сум", "uz": "soʻm", "en": "UZS"}[lang]
    return ("−" if amount < 0 else "") + text


T = {
    "purchase": {"ru": "Покупка {a}", "uz": "Xarid {a}", "en": "Purchase of {a}"},
    "repeats": {"ru": " (повторяется)", "uz": " (takrorlanadi)", "en": " (recurring)"},
    "first_gap": {"ru": ", первый разрыв {d}", "uz": ", birinchi uzilish {d}", "en": ", first gap on {d}"},
    "no": {
        "ru": "{what}: денег не хватит — остаток уйдёт в минус ({low} на {d}{when}).",
        "uz": "{what}: pul yetmaydi — qoldiq minusga tushadi ({low}, {d}{when}).",
        "en": "{what}: not enough money — the balance goes negative ({low} on {d}{when}).",
    },
    "risky": {
        "ru": "{what}: остаток не уйдёт в минус, но опустится до {low} на {d} — ниже запаса {buf} (резервы и конверты).",
        "uz": "{what}: qoldiq minusga tushmaydi, lekin {d} kuni {low} gacha kamayadi — zaxiradan ({buf}) past (zaxira va konvertlar).",
        "en": "{what}: the balance stays positive but drops to {low} on {d} — below the reserve of {buf} (reserves and envelopes).",
    },
    "yes": {
        "ru": "{what}: прогнозный остаток не опустится ниже {low} ({d}), запас {buf} цел.",
        "uz": "{what}: prognoz qoldigʻi {low} dan pasaymaydi ({d}), {buf} zaxira saqlanadi.",
        "en": "{what}: the forecast balance will not fall below {low} ({d}), the {buf} reserve stays intact.",
    },
    "later_date": {"ru": "Отложить на {n} дн.", "uz": "{n} kunga kechiktirish", "en": "Postpone by {n} days"},
    "smaller": {"ru": "Взять меньше: {a}", "uz": "Kamroq olish: {a}", "en": "Take less: {a}"},
    "split": {
        "ru": "Разделить: {a} сейчас и {b} через 30 дней",
        "uz": "Boʻlib toʻlash: hozir {a}, 30 kundan keyin {b}",
        "en": "Split: {a} now and {b} in 30 days",
    },
    "as1": {
        "ru": "Прогноз на 30 дней по средним поступлениям и расходам за последние 30 дней и плановым платежам",
        "uz": "30 kunlik prognoz: soʻnggi 30 kundagi oʻrtacha tushum va xarajatlar hamda rejalashtirilgan toʻlovlar asosida",
        "en": "30-day forecast based on average income and spending over the last 30 days plus planned payments",
    },
    "as2": {
        "ru": "Запас = налоговый резерв + конверты: {buf}",
        "uz": "Zaxira = soliq zaxirasi + konvertlar: {buf}",
        "en": "Reserve = tax reserve + envelopes: {buf}",
    },
    "as3": {"ru": "Покупка не записывается в учёт", "uz": "Xarid hisobga yozilmaydi", "en": "The purchase is not recorded in the books"},
    "debtor": {
        "ru": "Здравствуйте, {name}! Напоминаем о задолженности {a} (ближайший срок оплаты — {due}). Подскажите, пожалуйста, когда ждать оплату? Спасибо!",
        "uz": "Assalomu alaykum, {name}! {a} miqdoridagi qarz haqida eslatamiz (eng yaqin toʻlov muddati — {due}). Iltimos, toʻlovni qachon kutish mumkinligini ayting. Rahmat!",
        "en": "Hello, {name}! A friendly reminder about the outstanding {a} (nearest due date — {due}). Could you let us know when to expect the payment? Thank you!",
    },
}


def tr(key, lang, **kw):
    return T[key][lang].format(**kw)
