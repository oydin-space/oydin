"""OpenAI-совместимый клиент (OpenRouter): основная модель → запасная. Порт complete() из uzex_capital."""

import base64
import json
import logging
import re
import time
from urllib.request import Request, urlopen

from django.conf import settings

from . import observability

log = logging.getLogger(__name__)


class AiUnavailable(Exception):
    pass


def is_configured():
    return bool(settings.LLM_API_KEY and settings.LLM_BASE_URL and settings.LLM_MODEL) or bool(settings.ANTHROPIC_API_KEY)


# OpenRouter без кредитов/ключа/лимита — переключаемся на Anthropic напрямую.
PROVIDER_DOWN = (401, 402, 429)


def _anthropic_post(model, messages, *, timeout, temperature=None):
    system = "\n\n".join(m["content"] for m in messages if m["role"] == "system")
    body = {
        "model": model,
        "max_tokens": 2048,
        "system": system + "\nОтвечай одним JSON-объектом без пояснений вокруг.",
        "messages": [m for m in messages if m["role"] != "system"],
    }
    # temperature у новых Claude объявлен устаревшим (400), поэтому не передаём.
    request = Request("https://api.anthropic.com/v1/messages", data=json.dumps(body, ensure_ascii=False).encode(), headers={
        "Content-Type": "application/json",
        "x-api-key": settings.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "User-Agent": "oydin/1.0",
    }, method="POST")
    with urlopen(request, timeout=timeout) as response:
        result = json.load(response)
    content = "".join(block.get("text", "") for block in result["content"] if block.get("type") == "text")
    if not content.strip():
        raise ValueError("empty response")
    return content


def _models(*names):
    return list(dict.fromkeys(n for n in names if n))


def _post(model, messages, *, timeout, temperature=None):
    base = settings.LLM_BASE_URL.rstrip("/")
    url = base if base.endswith("/chat/completions") else base + "/chat/completions"
    body = {"model": model, "messages": messages, "response_format": {"type": "json_object"}}
    if temperature is not None:
        body["temperature"] = temperature
    payload = json.dumps(body, ensure_ascii=False).encode()
    request = Request(url, data=payload, headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {settings.LLM_API_KEY}",
        "User-Agent": "oydin/1.0",
    }, method="POST")
    with urlopen(request, timeout=timeout) as response:
        result = json.load(response)
    content = result["choices"][0]["message"]["content"]
    if not isinstance(content, str) or not content.strip():
        raise ValueError("empty response")
    return content


def _traceable(messages):
    """Копия сообщений для Langfuse: base64 аудио заменяем размером, чтобы не раздувать трейс."""
    out = []
    for m in messages:
        content = m["content"]
        if isinstance(content, list):
            content = [
                {**part, "input_audio": {**part["input_audio"], "data": f"<{len(part['input_audio']['data'])} base64 chars>"}}
                if part.get("type") == "input_audio" else part
                for part in content
            ]
        out.append({**m, "content": content})
    return out


def _run(models, messages, *, timeout, name, accept, temperature=None, anthropic_model=None):
    down = not settings.LLM_API_KEY or not settings.LLM_BASE_URL or not models
    if down and not (anthropic_model and settings.ANTHROPIC_API_KEY):
        raise AiUnavailable()
    # Общий бюджет на обе попытки меньше --timeout gunicorn (90с), чтобы воркер не убили посреди запасной модели.
    deadline = time.monotonic() + timeout
    for model in [] if down else models:
        remaining = deadline - time.monotonic()
        if remaining < 5:
            break
        try:
            with observability.generation(name, model, _traceable(messages)) as record:
                content = _post(model, messages, timeout=min(40, remaining), temperature=temperature)
                record(content)
            result = accept(content)
            if result is None:
                raise ValueError(f"unparseable: {content[:200]!r}")
            return result
        except Exception as error:  # сеть, HTTP, формат — пробуем запасную модель
            detail = error.read()[:300] if hasattr(error, "read") else ""
            log.warning("LLM %s failed: %r %s", model, error, detail)
            down = down or getattr(error, "code", None) in PROVIDER_DOWN
            if down:
                break
    if down and anthropic_model and settings.ANTHROPIC_API_KEY:
        return _run_anthropic(anthropic_model, messages, deadline, name, accept, temperature)
    raise AiUnavailable()


def _run_anthropic(model, messages, deadline, name, accept, temperature):
    remaining = max(deadline - time.monotonic(), 20)
    try:
        with observability.generation(name, model, messages) as record:
            content = _anthropic_post(model, messages, timeout=min(40, remaining), temperature=temperature)
            record(content)
        result = accept(content)
        if result is None:
            raise ValueError(f"unparseable: {content[:200]!r}")
        return result
    except Exception as error:
        detail = error.read()[:300] if hasattr(error, "read") else ""
        log.warning("Anthropic %s failed: %r %s", model, error, detail)
    raise AiUnavailable()


def complete(system, messages, *, timeout=60, name="chat", temperature=None, model=None):
    """JSON-ответ модели в виде dict: целиком, из первого {...} или как {"reply": ...} из обрывков."""

    def accept(content):
        parsed = parse_reply(content)
        if parsed is not None:
            return parsed
        reply = salvage_reply(content)
        return None if reply is None else {"reply": reply, "suggestions": []}

    # model — явная модель (классификация, судья); при её сбое подстрахует основная.
    models = _models(model, settings.LLM_MODEL, settings.LLM_FALLBACK_MODEL)
    classify = model is not None and model == settings.LLM_CLASSIFY_MODEL
    claude = settings.ANTHROPIC_CLASSIFY_MODEL if classify else settings.ANTHROPIC_MODEL
    return _run(models, [{"role": "system", "content": system}, *messages], timeout=timeout, name=name, accept=accept,
                temperature=temperature, anthropic_model=claude)


AUDIO_FORMATS = {"webm": "webm", "ogg": "ogg", "mp4": "m4a", "m4a": "m4a", "x-m4a": "m4a", "mpeg": "mp3", "mp3": "mp3", "wav": "wav", "x-wav": "wav"}
STT_PROMPT = (
    "Расшифруй речь дословно (русский или узбекский). Ничего не добавляй и не исправляй числа. "
    'Верни JSON: {"text": "..."}; если речи нет, {"text": ""}.'
)


def audio_format(content_type):
    return AUDIO_FORMATS.get(content_type.split("/")[-1].split(";")[0].lower())


def transcribe(audio, content_type, *, timeout=40):
    """Аудио → текст через модель с аудио-входом OpenRouter (input_audio)."""
    fmt = audio_format(content_type)
    if fmt is None:
        raise ValueError("unsupported audio format")
    messages = [{"role": "user", "content": [
        {"type": "text", "text": STT_PROMPT},
        {"type": "input_audio", "input_audio": {"data": base64.b64encode(audio).decode(), "format": fmt}},
    ]}]

    def accept(content):
        parsed = parse_reply(content)
        if parsed is not None and isinstance(parsed.get("text"), str):
            return parsed["text"].strip()
        return None

    models = _models(settings.STT_MODEL, settings.LLM_MODEL)
    return _run(models, messages, timeout=timeout, name="stt", accept=accept)


def parse_reply(content):
    """JSON-объект из ответа модели: целиком или первый {...} внутри текста."""
    for candidate in (content, content[content.find("{"):content.rfind("}") + 1] if "{" in content else ""):
        try:
            parsed = json.loads(candidate)
        except ValueError:
            continue
        if isinstance(parsed, dict):
            return parsed
    return None


REPLY_FIELD = re.compile(r'"reply"\s*:\s*"((?:[^"\\]|\\.)*)"', re.S)


def salvage_reply(text):
    """Текст reply из сломанного JSON; None, если строку достать нельзя."""
    match = REPLY_FIELD.search(text)
    if not match:
        return None
    try:
        reply = json.loads('"' + match.group(1) + '"')
    except ValueError:
        return None
    return reply.strip() or None
