"""Язык вопроса (ru / uz латиницей / en) — подсказка модели, на каком языке отвечать."""

import re

NAMES = {"ru": "русский", "uz": "узбекский (латиница)", "en": "английский"}
UZ_MARKERS = re.compile(
    r"o['’ʻ‘`]|g['’ʻ‘`]|\b(?:qancha|qachon|yetadi\w*|uchun|kerak|menga|mening|qaysi|nima|yo['’ʻ]q|so['’ʻ]m|to['’ʻ]la\w*|pul|foyda|oylik|soliq|mijoz|xarajat|kassa|va|bilan|bo['’ʻ]l\w*|\w+(?:dim|ladi|lar|ning|ga|da))\b",
    re.I,
)
EN_WORDS = re.compile(r"(?<![\w'’])(?:the|you|your|is|are|will|have|and|for|to|by|of|in|my|what|when|how|much|paid|pay|can|do|i|me)(?![\w'’])", re.I)


def detect(text):
    """'ru', если есть заметная кириллица (в том числе в смеси языков); иначе 'uz' или 'en' по словам."""
    cyr = len(re.findall(r"[а-яё]", text, re.I))
    lat = len(re.findall(r"[a-z]", text, re.I))
    if cyr and cyr >= 0.2 * (cyr + lat):
        return "ru"
    if not lat:
        return "ru"
    english, uzbek = len(EN_WORDS.findall(text)), len(UZ_MARKERS.findall(text))
    return "en" if english > uzbek else "uz" if uzbek else "ru"


MONEY = {
    "ru": "Суммы: «2,5 млн сум», «130 тыс. сум».",
    "uz": "Summalar: «2,5 mln soʻm», «130 ming soʻm»; kirill harflarini ishlatma.",
    "en": "Amounts: “2.5M UZS”, “130K UZS” (decimal point, never «млн»/«тыс.»); no Cyrillic.",
}


def instruction(code):
    """Язык ответа = язык интерфейса (code ru/uz/en), с форматом сумм этой локали."""
    return (f"\nЯЗЫК ОТВЕТА В ЭТОМ ДИАЛОГЕ: {NAMES[code]}. Пиши reply, suggestions, подписи графика и ui только на нём, "
            f"даже если вопрос на другом языке. {MONEY[code]} Названия категорий бери ровно как в ФАКТАХ.")
