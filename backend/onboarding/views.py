"""HTTP-слой онбординга: работает и без бизнеса (business=False) — новичок ещё не создал его."""

from accounts.access import active_membership
from accounts.http import ApiError, api_view, json_response, parse_json
from ai import memory
from ai.views import throttle
from django.conf import settings

from . import agent, flow, registry


@api_view("GET", business=False)
def state(request):
    return json_response(flow.state(request.user))


@api_view("POST", business=False)
def answer(request):
    body = parse_json(request)
    return json_response(flow.answer(request.user, body.get("step"), body.get("action", "submit"), body.get("value")))


@api_view("POST", business=False)
def lookup(request):
    body = parse_json(request)
    query = body.get("query")
    if not isinstance(query, str):
        raise ApiError(400, "invalid_query")
    if flow.is_demo(request.user):
        raise ApiError(403, "forbidden")
    try:
        row = registry.lookup(request.user, query)
    except registry.RateLimited:
        raise ApiError(429, "rate_limited") from None
    if row is None:
        raise ApiError(400, "invalid_query")
    return json_response(registry.serialize(row))


@api_view("POST", business=False)
def message(request):
    body = parse_json(request)
    text = body.get("text")
    if not isinstance(text, str) or not text.strip() or len(text) > 1000:
        raise ApiError(400, "invalid_text")
    if flow.is_demo(request.user):
        raise ApiError(400, "demo_business")
    throttle(request.user, "onboarding", settings.AI_CHAT_PER_MINUTE)
    step = body.get("step") or flow.session_for(request.user).current_step
    if step not in flow.STEPS:
        raise ApiError(400, "invalid_step")
    lang = body.get("lang") if body.get("lang") in flow.LANGS else "ru"
    return json_response(agent.message(request.user, step, text, lang))


@api_view("GET", business=False)
def context(request):
    """Что Oydin запомнил — те же данные, что видит ИИ через get_context."""
    membership = active_membership(request.user)
    if membership is None:
        return json_response({"user": None, "memory": [], "business": None})
    ctx = memory.get_context(membership.business, request.user, membership.role)
    ctx.setdefault("business", None)
    return json_response(ctx)
