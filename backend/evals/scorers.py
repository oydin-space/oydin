"""Оценщики золотого набора. Всё детерминированное, кроме judge_tone: фиксированная рубрика, только тон и ясность."""

import json
import re

from ai import grounding, llm

LATENCY_LIMIT = 30.0  # секунд на ответ чата (с инструментами)


def _count(pattern, text):
    return len(re.findall(pattern, text, re.I))


def no_fabricated_numbers(reply, evidence):
    return not grounding.ungrounded_numbers(reply, evidence)


def language(reply, expected):
    """ru — кириллица; en — латиница с английскими служебными словами; uz — остальная латиница; any — любой."""
    cyr, lat = _count(r"[а-яё]", reply), _count(r"[a-z]", reply)
    total = cyr + lat
    if not total:
        return False
    ru, latin = cyr / total > 0.7, lat / total > 0.7
    english = latin and _count(r"(?<![\w'’])(the|you|your|is|are|will|have|not|and|for|to|by|of|in|please|can|with|this|on)(?![\w'’])", reply) >= 2
    uz = latin and not english
    return {"ru": ru, "uz": uz, "en": english}.get(expected, ru or latin)


def draft_matches(draft, expected, accounts):
    """Поля черновика; account_kind сверяется по типу счёта, а не по id."""
    if draft is None:
        return False
    kinds = {a["id"]: a["kind"] for a in accounts}
    for key, value in expected.items():
        actual = kinds.get(draft.get("account_id")) if key == "account_kind" else draft.get(key)
        if actual != value:
            return False
    return True


def forbids(reply, banned):
    return not any(b.lower() in reply.lower() for b in banned)


def forbids_re(reply, patterns):
    return not any(re.search(p, reply, re.I) for p in patterns)


def _norm(text):
    return re.sub("[’ʻ‘`]", "'", text.lower())


def mentions_any(reply, options):
    return any(_norm(o) in _norm(reply) for o in options)


def mentions_all(reply, groups):
    return all(mentions_any(reply, g) for g in groups)


def latency_ok(seconds):
    return seconds <= LATENCY_LIMIT


RUBRIC = """Оцени ответ финансового помощника владельцу малого бизнеса по двум критериям, каждый от 1 до 5.
tone: 5 — спокойный, тёплый, без паники, восклицаний и капса; 3 — нейтральный/сухой; 1 — пугающий, грубый или заискивающий.
clarity: 5 — сначала главное (число или да/нет), затем причина и шаг, коротко и понятно неспециалисту; 3 — понятно, но длинно или размыто; 1 — запутанно.
Не оценивай точность чисел. Верни JSON {"tone": целое, "clarity": целое}."""
JUDGE_MIN = 3
JUDGE_MODEL = "anthropic/claude-haiku-5.5"  # фиксированный судья: оценки моделей сравнимы между собой


def judge(question, reply):
    """(tone, clarity) от LLM-судьи; None, если судья недоступен."""
    try:
        out = llm.complete(RUBRIC, [{"role": "user", "content": f"ВОПРОС: {question}\nОТВЕТ: {reply}"}], name="judge", temperature=0, timeout=40, model=JUDGE_MODEL)
    except llm.AiUnavailable:
        return None
    tone, clarity = out.get("tone"), out.get("clarity")
    if not all(isinstance(v, int) and 1 <= v <= 5 for v in (tone, clarity)):
        return None
    return tone, clarity


def dumps(value):
    return json.dumps(value, ensure_ascii=False)
