"""Тексты финансового ядра на ru / uz (латиница, ʻ = U+02BB) / en: суммы, даты, причина разрыва, пульс."""

from planning.texts import LANGS, resolve_lang  # noqa: F401  (resolve_lang — общий хелпер языка запроса)

MONTHS = {
    "ru": ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
    "uz": ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"],
    "en": ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
}

TRANSFER_CATEGORY = "Перевод между счетами"


def money(amount, lang="ru"):
    n = abs(int(amount))
    if n >= 1_000_000:
        value = n / 1_000_000
        num = f"{value:.0f}" if value >= 10 else f"{value:.1f}".rstrip("0").rstrip(".")
        text = num + "M" if lang == "en" else num.replace(".", ",") + (" млн" if lang == "ru" else " mln")
    elif n >= 1000:
        k = round(n / 1000)
        text = {"ru": f"{k} тыс.", "uz": f"{k} ming", "en": f"{k}K"}[lang]
    else:
        text = f"{n} " + {"ru": "сум", "uz": "soʻm", "en": "UZS"}[lang]
    return ("−" if amount < 0 else "") + text


def date_text(day, lang="ru"):
    month = MONTHS[lang][day.month - 1]
    if lang == "en":
        return f"{month} {day.day}"
    return f"{day.day}-{month}" if lang == "uz" else f"{day.day} {month}"


T = {
    "gap_payment": {
        "ru": "Платёж «{title}» на {a}: к этому дню денег на счетах не хватает",
        "uz": "«{title}» toʻlovi ({a}): shu kunga hisoblarda pul yetmaydi",
        "en": "Payment “{title}” of {a}: there is not enough money in your accounts by that day",
    },
    "gap_daily": {
        "ru": "Ежедневные расходы превышают поступления",
        "uz": "Kundalik xarajatlar tushumdan oshib ketadi",
        "en": "Daily spending exceeds income",
    },
    "headline_gap": {
        "ru": "{d} не хватит {a}",
        "uz": "{d} kuni {a} yetmaydi",
        "en": "Short by {a} on {d}",
    },
    "headline_covered": {
        "ru": "Обязательства до {d} покрыты",
        "uz": "{d} gacha boʻlgan majburiyatlar qoplangan",
        "en": "Obligations through {d} are covered",
    },
    "headline_calm": {
        "ru": "Ближайшие 30 дней спокойные",
        "uz": "Keyingi 30 kun xotirjam",
        "en": "The next 30 days look calm",
    },
    "transfer": {
        "ru": TRANSFER_CATEGORY,
        "uz": "Hisoblar oʻrtasida oʻtkazma",
        "en": "Transfer between accounts",
    },
    "free_money": {"ru": "Свободные деньги", "uz": "Erkin pul", "en": "Free money"},
    "free_money_hint": {
        "ru": "Можно потратить сегодня, не задев платежи на 30 дней вперёд",
        "uz": "Bugun sarflash mumkin, keyingi 30 kundagi toʻlovlarga tegmasdan",
        "en": "You can spend this today without touching payments for the next 30 days",
    },
    "reserved": {"ru": "Отложено под платежи", "uz": "Toʻlovlar uchun ajratilgan", "en": "Set aside for payments"},
    "reserved_hint": {
        "ru": "В конвертах {saved} из {target}",
        "uz": "Konvertlarda {target} dan {saved}",
        "en": "{saved} of {target} in envelopes",
    },
    "reserved_none": {"ru": "Конвертов пока нет", "uz": "Hozircha konvertlar yoʻq", "en": "No envelopes yet"},
    "owner_take": {"ru": "Можно взять себе", "uz": "Oʻzingizga olish mumkin", "en": "You can take for yourself"},
    "owner_take_hint": {
        "ru": "Не больше свободных денег и прибыли за месяц",
        "uz": "Erkin pul va oylik foydadan oshmasligi kerak",
        "en": "No more than free money and the month's profit",
    },
    "profit": {"ru": "Реальная прибыль за месяц", "uz": "Oylik haqiqiy foyda", "en": "Real profit this month"},
    "profit_hint": {
        "ru": "Выручка {revenue} минус расходы бизнеса {expenses}",
        "uz": "Tushum {revenue} minus biznes xarajatlari {expenses}",
        "en": "Revenue {revenue} minus business expenses {expenses}",
    },
    "personal_share": {"ru": "Личные траты из кассы", "uz": "Kassadan shaxsiy xarajatlar", "en": "Personal spending from the till"},
    "personal_share_hint": {
        "ru": "Доля нецелевых трат в расходах за 30 дней",
        "uz": "30 kunlik xarajatlarda maqsadsiz sarflar ulushi",
        "en": "Share of non-business spending in the last 30 days",
    },
}


def tr(key, lang="ru", **kw):
    return T[key][lang].format(**kw)


def transfer_label(lang):
    return T["transfer"][lang]
