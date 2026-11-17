"""Langfuse v5: трейсинг ответов ИИ. Без ключей — no-op (контекстные менеджеры отдают None)."""

import logging
import os
import threading
from collections.abc import Generator
from contextlib import contextmanager

from django.conf import settings

log = logging.getLogger(__name__)
_lock = threading.Lock()
_state = {"checked": False, "enabled": False}


def enabled():
    if _state["checked"]:
        return _state["enabled"]
    with _lock:
        if _state["checked"]:
            return _state["enabled"]
        _state["checked"] = True
        if settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY:
            os.environ.setdefault("LANGFUSE_PUBLIC_KEY", settings.LANGFUSE_PUBLIC_KEY)
            os.environ.setdefault("LANGFUSE_SECRET_KEY", settings.LANGFUSE_SECRET_KEY)
            os.environ.setdefault("LANGFUSE_BASE_URL", settings.LANGFUSE_BASE_URL)
            _state["enabled"] = True
    return _state["enabled"]


def _client():
    from langfuse import get_client

    return get_client()


@contextmanager
def ask_span(user_id, channel, question) -> Generator[str | None]:
    """Корневой спан запроса; отдаёт trace_id (или None, если трейсинг выключен)."""
    if not enabled():
        yield None
        return
    try:
        from langfuse import propagate_attributes

        client = _client()
        span = client.start_as_current_observation(as_type="span", name="ask", input=question)
        props = propagate_attributes(user_id=str(user_id), tags=[channel], metadata={"model": settings.LLM_MODEL})
    except Exception:
        log.warning("langfuse start failed", exc_info=True)
        yield None
        return
    with span, props:
        yield client.get_current_trace_id()


def set_output(kind, text):
    if enabled():
        try:
            _client().update_current_span(output={"kind": kind, "text": text})
        except Exception:
            log.warning("langfuse output failed", exc_info=True)


@contextmanager
def generation(name, model, messages):
    """Спан одного вызова модели; yield — функция record(output) (no-op без трейсинга)."""
    if not enabled():
        yield lambda output: None
        return
    try:
        cm = _client().start_as_current_observation(as_type="generation", name=name, model=model, input=messages)
    except Exception:
        log.warning("langfuse generation failed", exc_info=True)
        yield lambda output: None
        return
    with cm as obs:
        yield lambda output: obs.update(output=output)


def score(trace_id, name, value):
    if enabled() and trace_id:
        try:
            _client().create_score(trace_id=trace_id, name=name, value=value)
        except Exception:
            log.warning("langfuse score failed", exc_info=True)


def flush():
    if enabled():
        try:
            _client().flush()
        except Exception:
            log.warning("langfuse flush failed", exc_info=True)
