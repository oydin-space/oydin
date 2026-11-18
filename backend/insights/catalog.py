"""Кураторские карточки (рынок, местное, налоги). Каждая — с источником, датой проверки и уровнем уверенности.
Налоговые ставки — ориентир по soliq.uz/lex.uz, не консультация; перед использованием в отчётности сверяйте с законом.
Тексты — на ru / uz (латиница, ʻ = U+02BB) / en."""

from datetime import date

CURATED_AS_OF = date(2026, 11, 1)

_TEXT_FIELDS = ("title", "body", "source", "action")

MARKET_LOCAL = [
    {
        "id": "market-december-b2b",
        "kind": "market",
        "tone": "watch",
        "source_url": None,
        "as_of": CURATED_AS_OF,
        "confidence": "medium",
        "text": {
            "ru": {
                "title": "Декабрь — пик корпоративных заказов",
                "body": "Компании заказывают мерч и униформу к новому году. Согласуйте аванс не меньше 50% и сроки макета заранее — так закупка заготовок не ляжет на ваши деньги.",
                "source": "Наблюдение редакции Oydin, не статистика; проверьте на своём рынке",
                "action": "Как договориться с B2B-клиентом об авансе 50%?",
            },
            "uz": {
                "title": "Dekabr — korporativ buyurtmalar pallasi",
                "body": "Kompaniyalar yangi yilga merch va forma buyurtma qiladi. Avansni kamida 50% qilib va maket muddatlarini oldindan kelishib oling — shunda xomashyo xaridi sizning pulingizga tushmaydi.",
                "source": "Oydin tahririyatining kuzatuvi, statistika emas; oʻz bozoringizda tekshirib koʻring",
                "action": "B2B mijoz bilan 50% avansni qanday kelishish mumkin?",
            },
            "en": {
                "title": "December is the peak for corporate orders",
                "body": "Companies order merch and uniforms for the new year. Agree on an advance of at least 50% and on mockup deadlines early, so buying blanks does not come out of your own cash.",
                "source": "Oydin editorial observation, not statistics; check it on your own market",
                "action": "How do I agree a 50% advance with a B2B client?",
            },
        },
    },
    {
        "id": "local-prepay-habit",
        "kind": "local",
        "tone": "calm",
        "source_url": None,
        "as_of": CURATED_AS_OF,
        "confidence": "low",
        "text": {
            "ru": {
                "title": "Ташкентские B2B-клиенты часто платят после выдачи",
                "body": "Если заказ оплачивается после сдачи, деньги приходят позже платежей поставщику. Закладывайте 7–10 дней задержки в прогнозе и просите предоплату.",
                "source": "Наблюдение редакции Oydin, не статистика; проверьте на своём рынке",
                "action": "Когда придут деньги по моим B2B-заказам?",
            },
            "uz": {
                "title": "Toshkentdagi B2B mijozlar koʻpincha buyurtma topshirilgach toʻlaydi",
                "body": "Buyurtma topshirilgandan keyin toʻlansa, pul yetkazib beruvchiga toʻlovdan kechroq keladi. Prognozda 7–10 kun kechikishni hisobga oling va oldindan toʻlov soʻrang.",
                "source": "Oydin tahririyatining kuzatuvi, statistika emas; oʻz bozoringizda tekshirib koʻring",
                "action": "B2B buyurtmalarim boʻyicha pul qachon keladi?",
            },
            "en": {
                "title": "Tashkent B2B clients often pay after delivery",
                "body": "If an order is paid after handover, the money arrives later than your supplier payments. Allow 7–10 days of delay in the forecast and ask for a prepayment.",
                "source": "Oydin editorial observation, not statistics; check it on your own market",
                "action": "When will the money for my B2B orders arrive?",
            },
        },
    },
]


def market_local(lang="ru"):
    """Карточки каталога на нужном языке в общей форме инсайта."""
    return [
        {**{k: v for k, v in card.items() if k != "text"}, **{f: card["text"][lang][f] for f in _TEXT_FIELDS}}
        for card in MARKET_LOCAL
    ]
