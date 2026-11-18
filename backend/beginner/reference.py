"""Справочник форм регистрации в Узбекистане: только качественные факты, без ставок и расчётов.
Ставки, лимиты и сроки меняются — пользователь сверяет их на soliq.uz / my.gov.uz."""

LANGS = ("ru", "uz", "en")

SOURCES = [
    {"url": "https://my.gov.uz", "label": "my.gov.uz"},
    {"url": "https://soliq.uz", "label": "soliq.uz"},
    {"url": "https://my.soliq.uz", "label": "my.soliq.uz"},
]

FORMS = ("self_employed", "yatt", "mchj")

CHECKLIST = ("budget", "breakeven", "form", "register", "bank", "soliq")

_TEXT = {
    "ru": {
        "columns": {"form": "Форма", "who": "Для кого", "liability": "Ответственность", "staff": "Наёмные работники", "where": "Где оформить"},
        "forms": {
            "self_employed": {
                "name": "Самозанятый",
                "who": "Физическое лицо, которое работает на себя: услуги, ремесло, небольшая торговля.",
                "liability": "Отвечаете своим имуществом как физлицо.",
                "staff": "Работников нанимать нельзя.",
                "where": "Через my.soliq.uz или my.gov.uz.",
            },
            "yatt": {
                "name": "ЯТТ (индивидуальный предприниматель)",
                "who": "Физическое лицо с государственной регистрацией как предприниматель.",
                "liability": "Отвечаете всем своим имуществом.",
                "staff": "Можно нанимать работников.",
                "where": "Через my.gov.uz (государственная регистрация).",
            },
            "mchj": {
                "name": "МЧЖ / MChJ (ООО)",
                "who": "Юридическое лицо с одним или несколькими учредителями, отдельное от владельцев.",
                "liability": "Учредители отвечают в пределах своего вклада в уставный капитал.",
                "staff": "Можно нанимать работников.",
                "where": "Через my.gov.uz (государственная регистрация).",
            },
        },
        "disclaimer": "Это справка, а не налоговая консультация: режим налогообложения, ставки, лимиты и сроки мы не считаем. Перед выбором формы проверьте актуальные условия на soliq.uz и my.gov.uz или в налоговой инспекции.",
        "sources_title": "Официальные источники",
    },
    "uz": {
        "columns": {"form": "Shakl", "who": "Kim uchun", "liability": "Javobgarlik", "staff": "Yollanma xodimlar", "where": "Qayerda rasmiylashtiriladi"},
        "forms": {
            "self_employed": {
                "name": "Oʻzini oʻzi band qilgan shaxs",
                "who": "Oʻzi uchun ishlaydigan jismoniy shaxs: xizmat, hunarmandchilik, kichik savdo.",
                "liability": "Jismoniy shaxs sifatida oʻz mol-mulkingiz bilan javob berasiz.",
                "staff": "Xodim yollash mumkin emas.",
                "where": "my.soliq.uz yoki my.gov.uz orqali.",
            },
            "yatt": {
                "name": "YaTT (yakka tartibdagi tadbirkor)",
                "who": "Tadbirkor sifatida davlat roʻyxatidan oʻtgan jismoniy shaxs.",
                "liability": "Butun mol-mulkingiz bilan javob berasiz.",
                "staff": "Xodim yollash mumkin.",
                "where": "my.gov.uz orqali (davlat roʻyxati).",
            },
            "mchj": {
                "name": "MChJ (masʼuliyati cheklangan jamiyat)",
                "who": "Bir yoki bir nechta taʼsischisi bor, egalaridan alohida yuridik shaxs.",
                "liability": "Taʼsischilar ustav kapitaliga qoʻshgan hissasi doirasida javob beradi.",
                "staff": "Xodim yollash mumkin.",
                "where": "my.gov.uz orqali (davlat roʻyxati).",
            },
        },
        "disclaimer": "Bu maʼlumotnoma, soliq maslahati emas: soliq rejimi, stavkalar, limitlar va muddatlarni hisoblamaymiz. Shaklni tanlashdan oldin amaldagi shartlarni soliq.uz va my.gov.uz da yoki soliq inspeksiyasida tekshiring.",
        "sources_title": "Rasmiy manbalar",
    },
    "en": {
        "columns": {"form": "Form", "who": "Who it is for", "liability": "Liability", "staff": "Hiring employees", "where": "Where to register"},
        "forms": {
            "self_employed": {
                "name": "Self-employed",
                "who": "An individual working for themselves: services, crafts, small-scale trade.",
                "liability": "You are liable with your own property as an individual.",
                "staff": "You cannot hire employees.",
                "where": "Through my.soliq.uz or my.gov.uz.",
            },
            "yatt": {
                "name": "YaTT (sole proprietor)",
                "who": "An individual with state registration as an entrepreneur.",
                "liability": "You are liable with all your property.",
                "staff": "You can hire employees.",
                "where": "Through my.gov.uz (state registration).",
            },
            "mchj": {
                "name": "MChJ (LLC)",
                "who": "A legal entity with one or more founders, separate from its owners.",
                "liability": "Founders are liable up to their contribution to the charter capital.",
                "staff": "You can hire employees.",
                "where": "Through my.gov.uz (state registration).",
            },
        },
        "disclaimer": "This is a reference, not tax advice: we do not calculate tax regimes, rates, limits or deadlines. Before choosing a form, check current conditions on soliq.uz and my.gov.uz, or ask the tax office.",
        "sources_title": "Official sources",
    },
}


def lang_of(value):
    value = (value or "").lower()[:2]
    return value if value in LANGS else "ru"


def registration(lang):
    t = _TEXT[lang_of(lang)]
    return {
        "columns": t["columns"],
        "forms": [{"id": f, **t["forms"][f]} for f in FORMS],
        "disclaimer": t["disclaimer"],
        "sources_title": t["sources_title"],
        "sources": SOURCES,
    }
