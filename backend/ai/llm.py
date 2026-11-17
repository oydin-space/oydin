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
    return bool(settings.LLM_API_KEY and settings.LLM_BASE_URL and settings.LLM_MODEL)


def _models(*names):
    return list(dict.fromkeys(n for n in names if n))


def _post(model, messages, *, timeout):
    base = settings.LLM_BASE_URL.rstrip("/")
    url = base if base.endswith("/chat/completions") else base + "/chat/completions"
    payload = json.dumps(
        {"model": model, "messages": messages, "response_format": {"type": "json_object"}}, ensure_ascii=False
    ).encode()
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


def _run(models, messages, *, timeout, name, accept):
    if not settings.LLM_API_KEY or not settings.LLM_BASE_URL or not models:
        raise AiUnavailable()
    # Общий бюджет на обе попытки меньше --timeout gunicorn (90с), чтобы воркер не убили посреди запасной модели.
    deadline = time.monotonic() + timeout
    for model in models:
        remaining = deadline - time.monotonic()
        if remaining < 5:
            break
        try:
            with observability.generation(name, model, messages) as record:
                content = _post(model, messages, timeout=min(40, remaining))
                record(content)
            result = accept(content)
            if result is None:
                raise ValueError(f"unparseable: {content[:200]!r}")
            return result
        except Exception as error:  # сеть, HTTP, формат — пробуем запасную модель
            detail = error.read()[:300] if hasattr(error, "read") else ""
            log.warning("LLM %s failed: %r %s", model, error, detail)
    raise AiUnavailable()


def complete(system, messages, *, timeout=60):
    """JSON-ответ модели в виде dict: целиком, из первого {...} или как {"reply": ...} из обрывков."""

    def accept(content):
        parsed = parse_reply(content)
        if parsed is not None:
            return parsed
        reply = salvage_reply(content)
        return None if reply is None else {"reply": reply, "suggestions": []}

    models = _models(settings.LLM_MODEL, settings.LLM_FALLBACK_MODEL)
    return _run(models, [{"role": "system", "content": system}, *messages], timeout=timeout, name="chat", accept=accept)


AUDIO_FORMATS = {"webm": "webm", "ogg": "ogg", "mp4": "m4a", "m4a": "m4a", "mpeg": "mp3", "mp3": "mp3", "wav": "wav", "x-wav": "wav"}
STT_PROMPT = (
    "Расшифруй речь дословно (русский или узбекский). Ничего не добавляй и не исправляй числа. "
    'Верни JSON: {"text": "..."}; если речи нет, {"text": ""}.'
)


def transcribe(audio, content_type, *, timeout=40):
    """Аудио → текст через модель с аудио-входом OpenRouter (input_audio)."""
    subtype = content_type.split("/")[-1].split(";")[0].lower()
    audio_format = AUDIO_FORMATS.get(subtype)
    if audio_format is None:
        raise ValueError("unsupported audio format")
    messages = [{"role": "user", "content": [
        {"type": "text", "text": STT_PROMPT},
        {"type": "input_audio", "input_audio": {"data": base64.b64encode(audio).decode(), "format": audio_format}},
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
