"""Защита от SSRF для URL вебхуков: только https, хост должен резолвиться в публичные адреса."""

import ipaddress
import socket
from urllib.parse import urlsplit


class UnsafeUrl(ValueError):
    pass


def resolve(host, port):
    return [info[4][0] for info in socket.getaddrinfo(host, port, proto=socket.IPPROTO_TCP)]


def check_url(url):
    """Бросает UnsafeUrl, если url нельзя безопасно вызывать с сервера."""
    parts = urlsplit(url)
    if parts.scheme != "https":
        raise UnsafeUrl("only_https")
    host = parts.hostname
    if not host or parts.username or parts.password:
        raise UnsafeUrl("bad_url")
    try:
        port = parts.port or 443
    except ValueError:
        raise UnsafeUrl("bad_url") from None
    try:
        addresses = resolve(host, port)
    except OSError:
        raise UnsafeUrl("unresolvable_host") from None
    if not addresses:
        raise UnsafeUrl("unresolvable_host")
    for raw in addresses:
        ip = ipaddress.ip_address(raw.split("%")[0])
        if ip.version == 6 and ip.ipv4_mapped:
            ip = ip.ipv4_mapped
        if not ip.is_global:
            raise UnsafeUrl("private_address")
