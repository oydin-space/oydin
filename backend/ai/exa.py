"""Веб-поиск и исследование через Exa (https://docs.exa.ai): /search с contents и /answer. Без ключа выключено."""

import json
import logging
from urllib.request import Request, urlopen

from django.conf import settings

log = logging.getLogger(__name__)

BASE = "https://api.exa.ai"
TIMEOUT = 15
MAX_RESULTS = 5
SNIPPET = 600


def is_enabled():
    return bool(settings.EXA_API)


def _post(path, body):
    request = Request(BASE + path, data=json.dumps(body).encode(), headers={
        "Content-Type": "application/json", "x-api-key": settings.EXA_API, "User-Agent": "oydin/1.0",
    }, method="POST")
    with urlopen(request, timeout=TIMEOUT) as response:
        return json.load(response)


def _query(args):
    q = args.get("query")
    return q.strip()[:300] if isinstance(q, str) and q.strip() else None


def web_search(args):
    q = _query(args)
    if q is None:
        return {"error": "query обязателен"}
    if not is_enabled():
        return {"error": "web_search_disabled"}
    try:
        data = _post("/search", {"query": q, "numResults": MAX_RESULTS, "contents": {"text": {"maxCharacters": SNIPPET}}})
    except Exception as e:
        log.warning("Exa search failed: %r", e)
        return {"error": "web_search_unavailable"}
    results = [
        {"title": str(r.get("title") or "")[:200], "url": r.get("url"), "snippet": str(r.get("text") or "")[:SNIPPET]}
        for r in (data.get("results") or [])[:MAX_RESULTS] if r.get("url")
    ]
    return {"results": results, "note": "Ссылайся на источники по url"}


def research(args):
    q = _query(args)
    if q is None:
        return {"error": "query обязателен"}
    if not is_enabled():
        return {"error": "web_search_disabled"}
    try:
        data = _post("/answer", {"query": q, "text": False})
    except Exception as e:
        log.warning("Exa answer failed: %r", e)
        return {"error": "web_search_unavailable"}
    sources = [{"title": str(c.get("title") or "")[:200], "url": c.get("url")} for c in (data.get("citations") or [])[:MAX_RESULTS] if c.get("url")]
    return {"answer": str(data.get("answer") or "")[:2000], "sources": sources, "note": "Укажи источники (url) в ответе"}


def tool_web_search(business, args, user, role, lang=None):
    return web_search(args)


def tool_research(business, args, user, role, lang=None):
    return research(args)
