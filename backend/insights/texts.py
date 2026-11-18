"""Тексты инсайтов на ru / uz (латиница, ʻ = U+02BB) / en."""

T = {
    "growth_title": {
        "ru": "Расходы «{category}» выросли на {pct}%",
        "uz": "«{category}» xarajatlari {pct}% ga oshdi",
        "en": "“{category}” spending grew by {pct}%",
    },
    "growth_body": {
        "ru": "За 30 дней на «{category}» ушло {a} — на {pct}% больше, чем в предыдущие 30 дней.",
        "uz": "30 kun ichida «{category}» uchun {a} sarflandi — oldingi 30 kundagidan {pct}% koʻp.",
        "en": "Over 30 days, {a} went to “{category}” — {pct}% more than in the previous 30 days.",
    },
    "growth_source": {
        "ru": "Ваши подтверждённые операции",
        "uz": "Sizning tasdiqlangan operatsiyalaringiz",
        "en": "Your confirmed transactions",
    },
    "growth_action": {
        "ru": "Почему выросли расходы на «{category}»?",
        "uz": "«{category}» xarajatlari nega oshdi?",
        "en": "Why did “{category}” spending grow?",
    },
    "gap_body": {
        "ru": "{reason}. Это прогноз по вашим платежам и обычному темпу продаж.",
        "uz": "{reason}. Bu sizning toʻlovlaringiz va odatiy savdo surʼatiga asoslangan prognoz.",
        "en": "{reason}. This is a forecast based on your payments and your usual sales pace.",
    },
    "gap_source": {
        "ru": "Прогноз Oydin по вашим операциям и обязательствам",
        "uz": "Oydin prognozi: operatsiyalaringiz va majburiyatlaringiz asosida",
        "en": "Oydin forecast based on your transactions and obligations",
    },
    "gap_action": {
        "ru": "Как закрыть кассовый разрыв?",
        "uz": "Kassa uzilishini qanday yopish mumkin?",
        "en": "How can I close the cash gap?",
    },
}


def tr(key, lang="ru", **kw):
    return T[key][lang].format(**kw)
