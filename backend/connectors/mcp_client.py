"""Минимальный клиент MCP по streamable HTTP: initialize, tools/list, tools/call (JSON-RPC поверх POST)."""

import json

from . import vault
from .rest_client import MAX_RESPONSE, CallError, fetch

MAX_TOOLS = 50
PROTOCOL = "2025-03-26"


def _headers(connector, session_id=None):
    headers = {
        "Accept": "application/json, text/event-stream",
        "Content-Type": "application/json",
        "User-Agent": "Oydin-Connector/1",
    }
    try:
        secret = vault.reveal(connector, "auth_secret_enc")
    except vault.VaultError:
        raise CallError("vault_unavailable") from None
    if connector.auth_header and secret:
        headers[connector.auth_header] = secret
    if session_id:
        headers["Mcp-Session-Id"] = session_id
        headers["MCP-Protocol-Version"] = PROTOCOL
    return headers


def _parse(resp, request_id):
    """Достаёт JSON-RPC-ответ с нужным id из JSON или SSE-потока."""
    if "text/event-stream" in resp.headers.get("content-type", ""):
        for line in resp.text.splitlines():
            if line.startswith("data:"):
                try:
                    msg = json.loads(line[5:].strip())
                except ValueError:
                    continue
                if isinstance(msg, dict) and msg.get("id") == request_id:
                    return msg
        raise CallError("bad_response")
    try:
        msg = resp.json()
    except ValueError:
        raise CallError("bad_response") from None
    if isinstance(msg, list):
        msg = next((m for m in msg if isinstance(m, dict) and m.get("id") == request_id), None)
    if not isinstance(msg, dict):
        raise CallError("bad_response")
    return msg


def _post(connector, payload, session_id=None):
    return fetch("POST", connector.url, headers=_headers(connector, session_id), json=payload)


def _rpc(connector, method, params, session_id, request_id):
    resp = _post(connector, {"jsonrpc": "2.0", "id": request_id, "method": method, "params": params}, session_id)
    if resp.status_code >= 400:
        raise CallError(f"http_{resp.status_code}")
    msg = _parse(resp, request_id)
    if "error" in msg:
        err = msg["error"]
        raise CallError("rpc_error")
    result = msg.get("result")
    return (result if isinstance(result, dict) else {}), resp


def _session(connector):
    result, resp = _rpc(
        connector,
        "initialize",
        {"protocolVersion": PROTOCOL, "capabilities": {}, "clientInfo": {"name": "oydin", "version": "1"}},
        None,
        1,
    )
    session_id = resp.headers.get("mcp-session-id")
    _post(connector, {"jsonrpc": "2.0", "method": "notifications/initialized"}, session_id)
    return session_id


def list_tools(connector):
    session_id = _session(connector)
    result, _ = _rpc(connector, "tools/list", {}, session_id, 2)
    tools = []
    raw = result.get("tools", [])
    if not isinstance(raw, list):
        raise CallError("bad_response")
    for t in raw[:MAX_TOOLS]:
        if isinstance(t, dict) and isinstance(t.get("name"), str):
            tools.append({
                "name": t["name"],
                "description": str(t.get("description", ""))[:500],
                "inputSchema": t.get("inputSchema") if isinstance(t.get("inputSchema"), dict) else {"type": "object", "properties": {}},
            })
    return tools


def call_tool(connector, name, args):
    session_id = _session(connector)
    result, _ = _rpc(connector, "tools/call", {"name": name, "arguments": args or {}}, session_id, 2)
    content = result.get("content", [])
    content = content if isinstance(content, list) else []
    text = "\n".join(str(c.get("text", "")) for c in content if isinstance(c, dict) and c.get("type") == "text")
    return {"is_error": bool(result.get("isError")), "text": text[:MAX_RESPONSE]}
