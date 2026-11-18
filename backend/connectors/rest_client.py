"""Вызов простого REST-обработчика: шаблон URL с {param}, остальные параметры — query или JSON-тело."""

import json
import re
import time
from urllib.parse import quote, urlencode

import httpx

from publicapi import ssrf

from . import crypto

TIMEOUT = 10
DEADLINE = 15
MAX_BYTES = 1_000_000
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


class Fetched:
    def __init__(self, status_code, headers, content):
        self.status_code = status_code
        self.headers = headers
        self.content = content

    @property
    def text(self):
        return self.content.decode("utf-8", errors="replace")

    def json(self):
        return json.loads(self.content)


def fetch(method, url, *, headers, **kwargs):
    """Стримит ответ: обрывает после MAX_BYTES и по общему дедлайну DEADLINE. Ошибки — CallError с кодом."""
    deadline = time.monotonic() + DEADLINE
    try:
        ssrf.check_url(url, default_port_only=True)
        with httpx.stream(method, url, headers=headers, timeout=TIMEOUT, follow_redirects=False, **kwargs) as resp:
            chunks, size = [], 0
            for chunk in resp.iter_bytes():
                size += len(chunk)
                if size > MAX_BYTES:
                    raise CallError("response_too_large")
                if time.monotonic() > deadline:
                    raise CallError("timeout")
                chunks.append(chunk)
            return Fetched(resp.status_code, resp.headers, b"".join(chunks))
    except ssrf.UnsafeUrl as exc:
        raise CallError(str(exc)) from None
    except httpx.TimeoutException:
        raise CallError("timeout") from None
    except httpx.HTTPError:
        raise CallError("network_error") from None


def call(connector, args):
    """Возвращает {"status": int, "body": ...}; ошибки сети и SSRF — CallError."""
    url, kwargs = build_request(connector, args)
    headers = {"Accept": "application/json", "User-Agent": "Oydin-Connector/1"}
    secret = crypto.decrypt(connector.auth_secret_enc)
    if connector.auth_header and secret:
        headers[connector.auth_header] = secret
    resp = fetch(connector.method, url, headers=headers, **kwargs)
    text = resp.text[:MAX_RESPONSE]
    try:
        body = json.loads(text)
    except ValueError:
        body = text
    return {"status": resp.status_code, "body": body}
