"""Системные категории хранятся по-русски; модели и подсказкам на uz/en отдаём перевод, черновик возвращаем в каноническом виде."""

NAMES = {
    "Аренда": {"uz": "Ijara", "en": "Rent"},
    "Зарплата": {"uz": "Oylik", "en": "Salaries"},
    "Налоги": {"uz": "Soliqlar", "en": "Taxes"},
    "Кредит": {"uz": "Kredit", "en": "Loan"},
    "Поставщик": {"uz": "Yetkazib beruvchi", "en": "Supplier"},
    "Реклама": {"uz": "Reklama", "en": "Advertising"},
    "Транспорт": {"uz": "Transport", "en": "Transport"},
    "Питание": {"uz": "Ovqat", "en": "Food"},
    "Продукты": {"uz": "Oziq-ovqat", "en": "Groceries"},
    "Коммунальные": {"uz": "Kommunal", "en": "Utilities"},
    "Продажи": {"uz": "Sotuvlar", "en": "Sales"},
    "Розница": {"uz": "Chakana savdo", "en": "Retail"},
    "Оплата заказа": {"uz": "Buyurtma toʻlovi", "en": "Order payment"},
    "Предоплата заказа": {"uz": "Buyurtma oldindan toʻlovi", "en": "Order prepayment"},
    "Кофе": {"uz": "Qahva", "en": "Coffee"},
    "Кофе и молоко": {"uz": "Qahva va sut", "en": "Coffee and milk"},
    "Кофемашина в рассрочку": {"uz": "Qahva mashinasi (muddatli toʻlov)", "en": "Coffee machine (instalments)"},
    "Одежда": {"uz": "Kiyim", "en": "Clothing"},
    "Прочее": {"uz": "Boshqa", "en": "Other"},
    "Личное": {"uz": "Shaxsiy", "en": "Personal"},
    "Владельцу": {"uz": "Egasiga", "en": "Owner draw"},
    "Перевод": {"uz": "Oʻtkazma", "en": "Transfer"},
}
REVERSE = {v.casefold(): ru for ru, tr in NAMES.items() for v in (ru, *tr.values())}
KEYS = {"category", "label"}


def localize(name, lang):
    """Подпись категории на языке интерфейса; незнакомое имя (своя категория) — как есть."""
    return NAMES.get(name, {}).get(lang, name) if lang in ("uz", "en") else name


def canonical(name):
    """Каноническое (хранимое) имя: «Transport»/«Transport» → «Транспорт»; своё имя не меняем."""
    return REVERSE.get(name.casefold(), name)


def localize_data(data, lang):
    """Копия данных, где поля category/label с системными именами переведены на lang."""
    if lang not in ("uz", "en"):
        return data
    if isinstance(data, dict):
        return {k: localize(v, lang) if k in KEYS and isinstance(v, str) else localize_data(v, lang) for k, v in data.items()}
    if isinstance(data, list):
        return [localize_data(v, lang) for v in data]
    return data
