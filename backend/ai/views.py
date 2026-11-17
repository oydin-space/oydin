from django.conf import settings
from django.core.cache import cache
from django.http import HttpResponse

from accounts.http import ApiError, api_view, error, json_response, parse_json

from . import chat, llm, observability, voice

ROLES = {"user", "assistant"}
MAX_MESSAGES = 20
MAX_CHARS = 4000
MAX_AUDIO = 2 * 1024 * 1024


def throttle(user, kind, limit):
    key = f"ai:{kind}:{user.id}"
    cache.add(key, 0, 60)
    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, 60)
        count = 1
    if count > limit:
        raise ApiError(429, "Слишком много запросов, подождите минуту")


def check_messages(body):
    messages = body.get("messages")
    if not isinstance(messages, list) or not 1 <= len(messages) <= MAX_MESSAGES:
        raise ApiError(400, f"messages: от 1 до {MAX_MESSAGES} сообщений")
    clean = []
    for m in messages:
        if not isinstance(m, dict) or m.get("role") not in ROLES or not isinstance(m.get("content"), str):
            raise ApiError(400, "Сообщение: role user/assistant и текст content")
        content = m["content"].strip()
        if not content or len(content) > MAX_CHARS:
            raise ApiError(400, f"Текст сообщения: от 1 до {MAX_CHARS} символов")
        clean.append({"role": m["role"], "content": content})
    if clean[-1]["role"] != "user":
        raise ApiError(400, "Последнее сообщение должно быть от пользователя")
    return clean


@api_view("POST")
def chat_view(request):
    messages = check_messages(parse_json(request))
    throttle(request.user, "chat", settings.AI_CHAT_PER_MINUTE)
    reply = chat.answer(request.business, request.user, messages)
    observability.flush()
    return json_response(reply)


@api_view("POST")
def voice_view(request):
    upload = request.FILES.get("audio")
    if upload is None:
        return error(400, "Приложите аудио в поле audio")
    if upload.size > MAX_AUDIO or upload.size == 0:
        return error(400, "Аудио: не больше 2 МБ")
    throttle(request.user, "voice", settings.AI_VOICE_PER_MINUTE)
    try:
        result = voice.handle(request.business, request.user, upload.read(), upload.content_type or "")
    except ValueError:
        return error(400, "Не удалось обработать аудио: формат не поддерживается")
    except llm.AiUnavailable:
        return error(400, "Голосовой ввод сейчас недоступен — напишите текстом")
    finally:
        observability.flush()
    if not result["text"]:
        return error(400, "Не удалось расслышать — попробуйте ещё раз")
    return json_response(result)


@api_view("POST")
def feedback_view(request):
    body = parse_json(request)
    trace_id, value = body.get("trace_id"), body.get("value")
    if not isinstance(trace_id, str) or not trace_id or isinstance(value, bool) or value not in (0, 1):
        return error(400, "trace_id (строка) и value 0 или 1")
    observability.score(trace_id, "user_feedback", value)
    observability.flush()
    return HttpResponse(status=204)
