from unittest import mock

import httpx
from django.test import TestCase

from accounts.models import Membership
from finance.tests import jpost, make_user

from . import crypto, mcp_client, rest_client
from .models import Connector
from .services import connector_tools

PUBLIC = mock.patch("publicapi.ssrf.resolve", return_value=["93.184.216.34"])
REST = {
    "kind": "rest", "name": "Stock", "description": "Stock level", "method": "get",
    "url": "https://api.example.com/items/{sku}", "auth_header": "X-Api-Key", "auth_secret": "s3cret",
    "params_schema": {"type": "object", "properties": {"sku": {"type": "string"}, "wh": {"type": "string"}}, "required": ["sku"]},
}


class ConnectorsApiTests(TestCase):
    def setUp(self):
        self.owner, self.business, _ = make_user("conn_owner")
        Membership.objects.update_or_create(user=self.owner, business=self.business, defaults={"role": "owner"})
        self.client.force_login(self.owner)

    def create(self, **extra):
        with PUBLIC:
            return jpost(self.client, "/api/connectors/", {**REST, **extra})

    def test_create_encrypts_and_hides_secret(self):
        r = self.create()
        self.assertEqual(r.status_code, 201)
        data = r.json()
        self.assertTrue(data["has_secret"])
        self.assertNotIn("s3cret", r.content.decode())
        c = Connector.objects.get()
        self.assertNotIn("s3cret", c.auth_secret_enc)
        self.assertEqual(crypto.decrypt(c.auth_secret_enc), "s3cret")
        self.assertEqual(c.method, "GET")

    def test_owner_only(self):
        seller, _, _ = make_user("conn_seller")
        Membership.objects.create(user=seller, business=self.business, role="seller")
        seller.profile.business = self.business
        seller.profile.save()
        self.client.force_login(seller)
        self.assertEqual(self.client.get("/api/connectors/").status_code, 403)

    def test_tenant_isolation(self):
        cid = self.create().json()["id"]
        other, _, _ = make_user("conn_other")
        self.client.force_login(other)
        self.assertEqual(self.client.get(f"/api/connectors/{cid}/").status_code, 404)
        self.assertEqual(self.client.get("/api/connectors/").json(), [])

    def test_ssrf_rejected(self):
        with mock.patch("publicapi.ssrf.resolve", return_value=["10.0.0.1"]):
            r = jpost(self.client, "/api/connectors/", REST)
        self.assertEqual((r.status_code, r.json()["error"]), (400, "private_address"))
        r = jpost(self.client, "/api/connectors/", {**REST, "url": "http://api.example.com/{sku}"})
        self.assertEqual(r.json()["error"], "only_https")

    def test_validation(self):
        self.assertEqual(self.create(method="TRACE").json()["error"], "invalid_method")
        self.assertEqual(self.create(params_schema={"type": "object", "properties": {}}).json()["error"], "invalid_params_schema")
        self.assertEqual(self.create(kind="x").json()["error"], "invalid_kind")
        self.assertEqual(self.create(description="").json()["error"], "invalid_description")

    def test_patch_secret_and_delete(self):
        cid = self.create().json()["id"]
        r = self.client.patch(f"/api/connectors/{cid}/", {"auth_secret": "", "enabled": False}, content_type="application/json")
        self.assertEqual((r.json()["has_secret"], r.json()["enabled"]), (False, False))
        self.assertEqual(self.client.delete(f"/api/connectors/{cid}/").status_code, 200)
        self.assertFalse(Connector.objects.exists())

    def test_rest_test_endpoint(self):
        cid = self.create().json()["id"]
        resp = httpx.Response(200, json={"qty": 4})
        with PUBLIC, mock.patch("httpx.request", return_value=resp) as req:
            r = jpost(self.client, f"/api/connectors/{cid}/test/", {"args": {"sku": "a b", "wh": "1"}})
        self.assertEqual(r.json()["result"], {"status": 200, "body": {"qty": 4}})
        args, kwargs = req.call_args
        self.assertEqual(args, ("GET", "https://api.example.com/items/a%20b?wh=1"))
        self.assertEqual(kwargs["headers"]["X-Api-Key"], "s3cret")
        self.assertFalse(kwargs["follow_redirects"])

    def test_rest_missing_param_reports_error(self):
        cid = self.create().json()["id"]
        r = jpost(self.client, f"/api/connectors/{cid}/test/", {"args": {}})
        self.assertEqual((r.json()["ok"], r.json()["error"]), (False, "missing_param:sku"))

    def test_mcp_test_caches_tools_and_agent_tools(self):
        with PUBLIC:
            r = jpost(self.client, "/api/connectors/", {"kind": "mcp", "name": "CRM", "url": "https://mcp.example.com/mcp"})
        cid = r.json()["id"]
        tools = [{"name": "find-customer", "description": "Find", "inputSchema": {"type": "object", "properties": {"q": {"type": "string"}}}}]
        with mock.patch.object(mcp_client, "list_tools", return_value=tools):
            r = jpost(self.client, f"/api/connectors/{cid}/test/", {})
        self.assertTrue(r.json()["ok"])
        specs = connector_tools(self.business)
        self.assertEqual([s["name"] for s in specs], [f"c{cid}_find_customer"])
        with mock.patch.object(mcp_client, "call_tool", return_value={"is_error": False, "text": "ok"}) as call:
            self.assertEqual(specs[0]["call"]({"q": "x"})["text"], "ok")
        call.assert_called_once()
        self.assertEqual(call.call_args.args[1:], ("find-customer", {"q": "x"}))

    def test_connector_tools_rest_and_disabled(self):
        cid = self.create().json()["id"]
        specs = connector_tools(self.business)
        self.assertEqual(specs[0]["parameters"]["required"], ["sku"])
        with mock.patch.object(rest_client, "call", side_effect=rest_client.CallError("Timeout")):
            self.assertEqual(specs[0]["call"]({"sku": "1"}), {"error": "Timeout"})
        Connector.objects.filter(id=cid).update(enabled=False)
        self.assertEqual(connector_tools(self.business), [])


class McpClientTests(TestCase):
    def test_sse_and_session(self):
        c = Connector(kind="mcp", url="https://mcp.example.com/mcp")
        init = httpx.Response(200, json={"jsonrpc": "2.0", "id": 1, "result": {}}, headers={"mcp-session-id": "S1"})
        note = httpx.Response(202)
        sse = httpx.Response(
            200, headers={"content-type": "text/event-stream"},
            text='event: message\ndata: {"jsonrpc":"2.0","id":2,"result":{"content":[{"type":"text","text":"hi"}]}}\n\n',
        )
        with PUBLIC, mock.patch("httpx.post", side_effect=[init, note, sse]) as post:
            out = mcp_client.call_tool(c, "t", {"a": 1})
        self.assertEqual(out, {"is_error": False, "text": "hi"})
        self.assertEqual(post.call_args.kwargs["headers"]["Mcp-Session-Id"], "S1")
