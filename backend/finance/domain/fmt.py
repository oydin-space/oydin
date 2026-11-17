"""Мягкое форматирование сумм и дат для текстов: «2,5 млн», «130 тыс.», «5 декабря»."""

MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"]
MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]


def money(amount):
    n = abs(int(amount))
    if n >= 1_000_000:
        value = n / 1_000_000
        text = f"{value:.0f}" if value >= 10 else f"{value:.1f}".rstrip("0").rstrip(".")
        text = text.replace(".", ",") + " млн"
    elif n >= 1000:
        text = f"{round(n / 1000)} тыс."
    else:
        text = f"{n} сум"
    return ("−" if amount < 0 else "") + text


def ru_date(day):
    return f"{day.day} {MONTHS[day.month - 1]}"


def short_date(day):
    return f"{day.day} {MONTHS_SHORT[day.month - 1]}"
