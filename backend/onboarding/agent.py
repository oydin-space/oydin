"""Свободный текст в чате онбординга: LLM с инструментами, а без ИИ — детерминированный разбор.

Протокол модели: каждый ответ — JSON {"say": "...", "tool": "<имя>|null", "args": {...}}; до 3 раундов
инструментов. Любой сбой LLM молча переключает на эвристику — онбординг не зависит от ИИ.
"""

import json
import logging
import re

from accounts.access import active_membership
from accounts.consent import has_consent
from accounts.http import ApiError
from ai import llm, memory

from . import flow, registry

log = logging.getLogger(__name__)
MAX_ROUNDS = 3
LANG_NAMES = {"ru": "русском", "uz": "узбекском (латиница, буквы ʻ и ʼ)", "en": "английском"}

STEP_GOALS = {
    "consent": "получить согласие на обработку данных ИИ (это делает кнопка, не текст)",
    "name": "узнать имя и фамилию: save_profile {first_name, last_name}",
    "contact": "узнать телефон (+998), Telegram и удобный канал: save_profile {phone, telegram, email, channel: app|telegram|email}",
    "business": "найти бизнес по ИНН/ПИНФЛ/названию через lookup_company; создать вручную: save_profile {name, city, stage: running|idea}",
    "activity": "понять, чем занимается бизнес: save_profile {description, segment, team_size: solo|2_5|6_20|20plus}",
    "pains": f"узнать боли: save_profile {{tags: подмножество {sorted(flow.PAINS)} (до 3), other}}",
    "goals": f"узнать цели на 3 месяца: save_profile {{tags: подмножество {sorted(flow.GOALS)} (до 2), other}}",
    "upload": "предложить загрузить выписку или начать с нуля (кнопками)",
    "invite": "предложить пригласить команду (кнопками)",
    "install": "предложить установить приложение на экран (кнопками)",
    "tour": "показать, что умеет Oydin; можно спросить время утренней сводки: save_profile {brief_time: HH:MM}",
    "summary": "показать, что Oydin запомнил, и завершить",
}


def ai_allowed(user):
    return llm.is_configured() and has_consent(user, "ai")


# --- эвристика без ИИ ----------------------------------------------------------------------------

PHONE_RE = re.compile(r"(?:\+?998)?[\s(-]*\d{2}[\s)-]*\d{3}[\s-]*\d{2}[\s-]*\d{2}")
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
TG_RE = re.compile(r"(?:t\.me/|@)([A-Za-z][A-Za-z0-9_]{4,31})")


def heuristic(step, text):
    """('submit', value) | ('lookup', query) | (None, None) — что можно понять из текста без модели."""
    if step == "name":
        words = [w for w in re.split(r"\s+", text.strip()) if w][:3]
        if words and all(len(w) <= 60 for w in words):
            return "submit", {"first_name": words[0].strip(",.").title(), "last_name": " ".join(words[1:]).strip(",.").title()}
    if step == "contact":
        email = EMAIL_RE.search(text)
        rest = EMAIL_RE.sub(" ", text)
        tg = TG_RE.search(rest)
        ph = PHONE_RE.search(TG_RE.sub(" ", rest))
        if email or tg or ph:
            channel = "telegram" if tg else "app"
            return "submit", {
                "phone": ph.group(0) if ph else "",
                "telegram": tg.group(1) if tg else "",
                "email": email.group(0) if email else "",
                "channel": channel,
            }
    if step == "business":
        kind, _ = registry.classify(text)
        if kind:
            return "lookup", text
    if step == "activity" and text.strip():
        return "submit", {"description": text.strip()[:300]}
    if step in {"pains", "goals"} and text.strip():
        return "submit", {"other": text.strip()[:200]}
    if step == "tour":
        match = re.search(r"\b([01]?\d|2[0-3])[:.]([0-5]\d)\b", text)
        if match:
            return "submit", {"brief_time": f"{int(match[1]):02d}:{match[2]}"}
    return None, None


def run_lookup(user, query):
    try:
        row = registry.lookup(user, query)
    except registry.RateLimited:
        return {"error": "rate_limited"}
    return registry.serialize(row) if row else {"error": "invalid_query"}


def fallback(user, step, text):
    action, payload = heuristic(step, text)
    if action == "lookup":
        found = run_lookup(user, payload)
        return {"say": None, "say_key": None if "error" not in found else f"onboarding.error.{found['error']}", "lookup": found}
    if action == "submit":
        try:
            flow.answer(user, step, "submit", payload)
            return {"say": None, "say_key": "onboarding.agent.saved"}
        except ApiError as exc:
            return {"say": None, "say_key": f"onboarding.error.{exc.message}"}
    return {"say": None, "say_key": "onboarding.agent.useControls"}


# --- LLM с инструментами -------------------------------------------------------------------------


def tool_call(user, step, name, args):
    membership = active_membership(user)
    business = membership.business if membership else None
    role = membership.role if membership else None
    if name == "get_context":
        return memory.get_context(business, user, role) if business else flow.state(user)
    if name == "lookup_company":
        return run_lookup(user, str(args.get("query", "")))
    if name == "save_profile":
        try:
            return {"ok": True, "state": flow.answer(user, step, "submit", args)}
        except ApiError as exc:
            return {"error": exc.message}
    if name == "advance_onboarding":
        try:
            return {"ok": True, "state": flow.answer(user, step, "skip", None)}
        except ApiError as exc:
            return {"error": exc.message}
    if name == "remember":
        if business is None:
            return {"error": "business_required"}
        return memory.remember(business, user, role, args.get("scope") or "user", str(args.get("text", "")), source="onboarding")
    return {"error": "unknown_tool"}


def system_prompt(user, step, lang):
    return (
        "Ты — Oydin, ИИ-помощник малого бизнеса в Узбекистане. Сейчас идёт знакомство с новым пользователем.\n"
        f"Отвечай на {LANG_NAMES.get(lang, LANG_NAMES['ru'])} языке, тепло и коротко (1–2 предложения), без markdown.\n"
        f"Текущий шаг: {step}. Цель шага: {STEP_GOALS.get(step, '')}.\n"
        "Инструменты: get_context {}, lookup_company {query}, save_profile {...поля шага}, remember {scope: user|business, text}, "
        "advance_onboarding {} (пропустить шаг, только если пользователь сам просит).\n"
        "Отвечай строго JSON: {\"say\": \"текст пользователю\", \"tool\": имя или null, \"args\": {}}. "
        "Не выдумывай данные компании — только то, что вернул lookup_company. Не проси ПИНФЛ без нужды.\n"
        f"Состояние: {json.dumps(flow.state(user), ensure_ascii=False, default=str)[:3000]}"
    )


def with_llm(user, step, text, lang):
    messages = [{"role": "user", "content": text[:1000]}]
    lookup = None
    for _ in range(MAX_ROUNDS):
        reply = llm.complete(system_prompt(user, step, lang), messages, timeout=30, name="onboarding")
        tool = reply.get("tool") if isinstance(reply, dict) else None
        say = (reply.get("say") or reply.get("reply") or "") if isinstance(reply, dict) else ""
        if not tool:
            return {"say": str(say)[:600] or None, "say_key": None if say else "onboarding.agent.useControls", "lookup": lookup}
        args = reply.get("args") if isinstance(reply.get("args"), dict) else {}
        result = tool_call(user, step, tool, args)
        if tool == "lookup_company" and "error" not in result:
            lookup = result
        messages += [
            {"role": "assistant", "content": json.dumps(reply, ensure_ascii=False)},
            {"role": "user", "content": f"Результат {tool}: {json.dumps(result, ensure_ascii=False, default=str)[:2000]}"},
        ]
    return {"say": None, "say_key": "onboarding.agent.saved", "lookup": lookup}


def message(user, step, text, lang="ru"):
    if ai_allowed(user):
        try:
            out = with_llm(user, step, text, lang)
        except llm.AiUnavailable as exc:
            log.info("onboarding llm unavailable: %s", exc)
            out = fallback(user, step, text)
    else:
        out = fallback(user, step, text)
    out.setdefault("lookup", None)
    return {**out, "state": flow.state(user)}
