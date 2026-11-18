"""Инструменты коннекторов для ИИ-агента."""

import re

from . import mcp_client, rest_client
from .models import Connector


def _slug(value):
    return re.sub(r"[^a-z0-9]+", "_", value.lower()).strip("_") or "tool"


def _safe(fn, *a):
    try:
        return fn(*a)
    except rest_client.CallError as exc:
        return {"error": str(exc)}


def connector_tools(business):
    """[{name, description, parameters (JSON Schema), connector_id, call(args) -> dict}] по включённым коннекторам бизнеса.
    Без сетевых запросов: схемы MCP берутся из кеша, обновляется он тестом коннектора."""
    specs = []
    for c in Connector.objects.filter(business=business, enabled=True):
        prefix = f"c{c.id}_"
        if c.kind == Connector.Kind.REST:
            params = c.params_schema if isinstance(c.params_schema, dict) and c.params_schema else {"type": "object", "properties": {}}
            specs.append({
                "name": (prefix + _slug(c.name))[:64], "description": c.description or c.name, "parameters": params,
                "connector_id": c.id, "call": lambda args, c=c: _safe(rest_client.call, c, args),
            })
            continue
        for t in c.tools_cache:
            specs.append({
                "name": (prefix + _slug(t["name"]))[:64], "description": t.get("description") or c.name,
                "parameters": t.get("inputSchema") or {"type": "object", "properties": {}}, "connector_id": c.id,
                "call": lambda args, c=c, n=t["name"]: _safe(mcp_client.call_tool, c, n, args),
            })
    return specs
