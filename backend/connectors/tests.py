from unittest import mock

import httpx
from django.test import TestCase

from accounts.models import Membership
from finance.tests import jpost, make_user

from . import crypto, mcp_client, rest_client
from .models import Connector
from .services import connector_tools

PUBLIC = mock.patch("publicapi.ssrf.resolve", return_value=["93.184.216.34"])


def stream(*responses):
    """Подмена httpx.stream: отдаёт готовые ответы по очереди как контекстные менеджеры."""
    cms = []
    for r in responses:
        cm = mock.MagicMock()
        cm.__enter__.return_value = r
        cms.append(cm)
    return mock.patch("httpx.stream", side_effect=cms)


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
        with PUBLIC, stream(resp) as req:
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
        with mock.patch.object(rest_client, "call", side_effect=rest_client.CallError("timeout")):
            self.assertEqual(specs[0]["call"]({"sku": "1"}), {"error": "timeout"})
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
        with PUBLIC, stream(init, note, sse) as post:
            out = mcp_client.call_tool(c, "t", {"a": 1})
        self.assertEqual(out, {"is_error": False, "text": "hi"})
        self.assertEqual(post.call_args.kwargs["headers"]["Mcp-Session-Id"], "S1")


class SecurityTests(TestCase):
    def setUp(self):
        self.owner, self.business, _ = make_user("conn_sec")
        Membership.objects.update_or_create(user=self.owner, business=self.business, defaults={"role": "owner"})
        self.client.force_login(self.owner)

    def create(self, **extra):
        with PUBLIC:
            return jpost(self.client, "/api/connectors/", {**REST, **extra})

    def test_demo_business_forbidden(self):
        cid = self.create().json()["id"]
        self.business.is_demo = True
        self.business.save()
        self.assertEqual(self.create().status_code, 403)
        r = self.client.patch(f"/api/connectors/{cid}/", {"enabled": False}, content_type="application/json")
        self.assertEqual((r.status_code, r.json()["error"]), (403, "forbidden"))
        self.assertEqual(self.client.delete(f"/api/connectors/{cid}/").status_code, 403)
        self.assertEqual(jpost(self.client, f"/api/connectors/{cid}/test/", {}).status_code, 403)
        self.assertEqual(self.client.get("/api/connectors/").status_code, 200)

    def test_header_denylist(self):
        for name in ("Host", "content-length", "Transfer-Encoding", "Connection", "Upgrade", "TE", "Trailer", "Keep-Alive", "Proxy-Authorization"):
            r = self.create(auth_header=name)
            self.assertEqual((r.status_code, r.json()["error"]), (400, "invalid_header"), name)

    def test_port_rejected(self):
        r = self.create(url="https://api.example.com:8443/items/{sku}")
        self.assertEqual((r.status_code, r.json()["error"]), (400, "bad_port"))
        self.assertEqual(self.create(url="https://api.example.com:443/items/{sku}").status_code, 201)

    def test_oversize_response_aborted(self):
        c = Connector(kind="rest", method="GET", url="https://api.example.com/x")
        big = httpx.Response(200, content=b"a" * (rest_client.MAX_BYTES + 1))
        with PUBLIC, stream(big):
            with self.assertRaises(rest_client.CallError) as ctx:
                rest_client.call(c, {})
        self.assertEqual(str(ctx.exception), "response_too_large")

    def test_deadline_enforced(self):
        c = Connector(kind="rest", method="GET", url="https://api.example.com/x")
        slow = httpx.Response(200, content=b"abc")
        with PUBLIC, stream(slow), mock.patch("time.monotonic", side_effect=[0, 100]):
            with self.assertRaises(rest_client.CallError) as ctx:
                rest_client.call(c, {})
        self.assertEqual(str(ctx.exception), "timeout")

    def test_error_is_generic_code(self):
        cid = self.create().json()["id"]
        with PUBLIC, mock.patch("httpx.stream", side_effect=httpx.ConnectError("boom internal")):
            r = jpost(self.client, f"/api/connectors/{cid}/test/", {"args": {"sku": "1"}})
        self.assertEqual(r.json()["error"], "network_error")

    def test_test_endpoint_throttled(self):
        cid = self.create().json()["id"]
        codes = [jpost(self.client, f"/api/connectors/{cid}/test/", {"args": {}}).status_code for _ in range(8)]
        self.assertEqual(codes[:6], [200] * 6)
        self.assertEqual(codes[-1], 429)

    def test_patch_url_clears_tools_cache(self):
        with PUBLIC:
            cid = jpost(self.client, "/api/connectors/", {"kind": "mcp", "name": "CRM", "url": "https://mcp.example.com/mcp"}).json()["id"]
        Connector.objects.filter(id=cid).update(tools_cache=[{"name": "t"}])
        with PUBLIC:
            self.client.patch(f"/api/connectors/{cid}/", {"name": "CRM2"}, content_type="application/json")
            self.assertEqual(len(Connector.objects.get(id=cid).tools_cache), 1)
            self.client.patch(f"/api/connectors/{cid}/", {"url": "https://other.example.com/mcp"}, content_type="application/json")
        self.assertEqual(Connector.objects.get(id=cid).tools_cache, [])

    def test_mcp_tools_capped_and_typed(self):
        c = Connector(kind="mcp", url="https://mcp.example.com/mcp")
        tools = ["junk", 5] + [{"name": f"t{i}"} for i in range(80)]
        with mock.patch.object(mcp_client, "_session", return_value=None), mock.patch.object(
            mcp_client, "_rpc", return_value=({"tools": tools}, None)
        ):
            out = mcp_client.list_tools(c)
        self.assertEqual(len(out), 48)
        with mock.patch.object(mcp_client, "_session", return_value=None), mock.patch.object(
            mcp_client, "_rpc", return_value=({"tools": "x"}, None)
        ):
            with self.assertRaises(rest_client.CallError):
                mcp_client.list_tools(c)
