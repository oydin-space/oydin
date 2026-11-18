"""Вызов простого REST-обработчика: шаблон URL с {param}, остальные параметры — query или JSON-тело."""

import json
import re
from urllib.parse import quote, urlencode

import httpx

from publicapi import ssrf

from . import crypto

TIMEOUT = 10
MAX_RESPONSE = 20000
PLACEHOLDER = re.compile(r"\{([A-Za-z_][A-Za-z0-9_]*)\}")
METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE")


class CallError(Exception):
    pass


def placeholders(template):
    return PLACEHOLDER.findall(template)


def build_request(connector, args):
    args = dict(args or {})
    names = placeholders(connector.url)
    missing = [n for n in names if n not in args or isinstance(args[n], (dict, list)) or args[n] is None]
    if missing:
        raise CallError("missing_param:" + ",".join(missing))
    url = PLACEHOLDER.sub(lambda m: quote(str(args[m.group(1)]), safe=""), connector.url)
    rest = {k: v for k, v in args.items() if k not in names}
    kwargs = {}
    if connector.method in ("GET", "DELETE"):
        if rest:
            url += ("&" if "?" in url else "?") + urlencode({k: json.dumps(v) if isinstance(v, (dict, list)) else v for k, v in rest.items()})
    else:
        kwargs["json"] = rest
    return url, kwargs


def call(connector, args):
    """Возвращает {"status": int, "body": ...}; ошибки сети и SSRF — CallError."""
    url, kwargs = build_request(connector, args)
    headers = {"Accept": "application/json", "User-Agent": "Oydin-Connector/1"}
    secret = crypto.decrypt(connector.auth_secret_enc)
    if connector.auth_header and secret:
        headers[connector.auth_header] = secret
    try:
        ssrf.check_url(url)
        resp = httpx.request(connector.method, url, headers=headers, timeout=TIMEOUT, follow_redirects=False, **kwargs)
    except ssrf.UnsafeUrl as exc:
        raise CallError(str(exc)) from None
    except httpx.HTTPError as exc:
        raise CallError(type(exc).__name__) from None
    text = resp.text[:MAX_RESPONSE]
    try:
        body = json.loads(text)
    except ValueError:
        body = text
    return {"status": resp.status_code, "body": body}
