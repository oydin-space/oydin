from unittest import mock

import httpx
from django.core.cache import cache
from django.test import TestCase, override_settings

from accounts.models import Membership
from finance.models import Account, Transaction
from finance.tests import jpost, make_user

from . import crypto, didox, mcp_client, rest_client, vault
from .models import Connector, DidoxAccount
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


# Записанные ответы Didox (формат из api-docs.didox.uz, данные обезличены).
DIDOX_LOGIN = {"token": "11111111-2222-3333-4444-555555555555", "taxId": "300000001", "pinfl": None, "name": "OOO TEST SAVDO"}
DIDOX_INFO = {
    "tin": "300000001", "name": "OOO TEST SAVDO MCHJ", "shortName": "OOO TEST SAVDO", "regDate": "12.05.2019",
    "na1Name": "Общество с ограниченной ответственностью", "statusName": "Действующий", "address": "Toshkent sh.",
    "oked": "47190", "director": "ALIEV A.", "selfEmployment": False, "VATRegCode": "326010012345", "VATRegStatus": 20,
}
DIDOX_OUT = {"data": [
    {"doc_id": "D-OUT-1", "name": "17", "doc_date": "2024-05-02", "doctype": "002", "doc_status": 3, "owner": 1,
     "partnerCompany": "OOO MIJOZ", "total_delivery_sum_with_vat": "1120000.00"},
], "total": 1, "next_page_url": None}
DIDOX_IN = {"data": [
    {"doc_id": "D-IN-1", "name": "A-5", "doc_date": "03.05.2024", "doctype": "002", "doc_status": 3, "owner": 0,
     "partnerCompany": "OOO YETKAZUVCHI", "total_delivery_sum_with_vat": 560000},
], "total": 1, "next_page_url": None}


def reply(status, body):
    return httpx.Response(status, json=body, request=httpx.Request("GET", "https://api-partners.didox.uz/x"))


def didox_http(*responses):
    return mock.patch("httpx.request", side_effect=list(responses))


@override_settings(DIDOX_PARTNER_TOKEN="partner")
class DidoxTests(TestCase):
    def setUp(self):
        self.owner, self.business, _ = make_user("didox_owner")
        Membership.objects.update_or_create(user=self.owner, business=self.business, defaults={"role": "owner"})
        self.client.force_login(self.owner)
        Account.objects.create(business=self.business, name="Bank", kind="bank")

    def connect(self):
        with didox_http(reply(200, DIDOX_LOGIN)) as http:
            r = self.client.put("/api/connectors/didox/", {"tax_id": "300000001", "password": "pa55"}, content_type="application/json")
        return r, http

    def test_info_parses_vat_and_self_employment(self):
        with didox_http(reply(200, DIDOX_INFO)) as http:
            card = didox.taxpayer("key", "300000001")
        headers = http.call_args.kwargs["headers"]
        self.assertEqual((headers["Partner-Authorization"], headers["user-key"]), ("partner", "key"))
        self.assertEqual((card["name"], card["vat_payer"], card["self_employed"], card["registered_at"]), ("OOO TEST SAVDO", True, False, "12.05.2019"))
        with didox_http(reply(200, {**DIDOX_INFO, "selfEmployment": True, "VATRegStatus": None})):
            card = didox.taxpayer("key", "52005098660032")
        self.assertEqual((card["self_employed"], card["vat_payer"]), (True, None))

    def test_errors_map_to_codes_without_details(self):
        cases = [(reply(422, {"error": "Incorrect login"}), "bad_credentials"), (reply(429, {}), "too_many_attempts"),
                 (reply(401, {}), "unauthorized"), (reply(500, {"message": "Server Error"}), "unavailable"),
                 (httpx.ConnectError("https://api-partners.didox.uz/v1/auth/300000001"), "unavailable")]
        for resp, code in cases:
            with didox_http(resp), self.assertRaises(didox.DidoxError) as ctx:
                didox.login("300000001", "pa55")
            self.assertEqual(str(ctx.exception), code)
        with override_settings(DIDOX_PARTNER_TOKEN=""), mock.patch.dict("os.environ", {"DIDOX_PARTNER_TOKEN": ""}):
            with self.assertRaises(didox.DidoxError) as ctx:
                didox.login("300000001", "pa55")
        self.assertEqual(str(ctx.exception), "not_configured")

    def test_connect_encrypts_password_and_masks_tax_id(self):
        r, http = self.connect()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(http.call_args.kwargs["json"], {"password": "pa55"})
        body = r.content.decode()
        self.assertNotIn("pa55", body)
        self.assertNotIn("300000001", body)
        self.assertEqual(r.json()["tax_id"], "•••••0001")
        a = DidoxAccount.objects.get()
        self.assertEqual(crypto.decrypt(a.password_enc), "pa55")

    def test_connect_rejects_bad_login(self):
        with didox_http(reply(422, {"error": "Incorrect login"})):
            r = self.client.put("/api/connectors/didox/", {"tax_id": "300000001", "password": "x"}, content_type="application/json")
        self.assertEqual((r.status_code, r.json()["error"]), (400, "didox_bad_credentials"))
        self.assertFalse(DidoxAccount.objects.exists())

    def test_sync_imports_drafts_once(self):
        self.connect()
        with didox_http(reply(200, DIDOX_LOGIN), reply(200, DIDOX_OUT), reply(200, DIDOX_IN)) as http:
            r = jpost(self.client, "/api/connectors/didox/sync/", {})
        self.assertEqual((r.json()["ok"], r.json()["created"]), (True, 2))
        params = http.call_args_list[1].kwargs["params"]
        self.assertEqual((params["doctype"], params["status"], params["owner"]), ("002", 3, 1))
        sale = Transaction.objects.get(direction="in")
        self.assertEqual((sale.amount, sale.status, sale.source, sale.counterparty), (1120000, "draft", "import", "OOO MIJOZ"))
        self.assertEqual(str(Transaction.objects.get(direction="out").date), "2024-05-03")
        cache.clear()
        with didox_http(reply(200, DIDOX_LOGIN), reply(200, DIDOX_OUT), reply(200, DIDOX_IN)):
            r = jpost(self.client, "/api/connectors/didox/sync/", {})
        self.assertEqual(r.json()["created"], 0)
        self.assertEqual(Transaction.objects.count(), 2)

    def test_sync_error_is_recorded(self):
        self.connect()
        with didox_http(reply(423, {})):
            r = jpost(self.client, "/api/connectors/didox/sync/", {}).json()
        self.assertEqual((r["ok"], r["error"]), (False, "didox_locked"))
        self.assertEqual(DidoxAccount.objects.get().last_error, "locked")

    def test_demo_forbidden(self):
        self.business.is_demo = True
        self.business.save()
        r = self.client.put("/api/connectors/didox/", {"tax_id": "300000001", "password": "x"}, content_type="application/json")
        self.assertEqual(r.status_code, 403)


VAULT_ENV = {"VAULT_ADDR": "http://vault:8200", "VAULT_TOKEN": "hvs.app"}


def fake_vault(url, json=None, headers=None, **kwargs):
    """Подмена Transit: «шифртекст» = vault:v1: + base64 открытого текста (только для тестов)."""
    action = url.rsplit("/", 2)[-2]
    if action == "encrypt":
        return httpx.Response(200, json={"data": {"ciphertext": "vault:v1:" + json["plaintext"]}}, request=httpx.Request("POST", url))
    return httpx.Response(200, json={"data": {"plaintext": json["ciphertext"][len("vault:v1:"):]}}, request=httpx.Request("POST", url))


@override_settings(DIDOX_PARTNER_TOKEN="partner")
class VaultTests(TestCase):
    def test_falls_back_to_fernet_without_vault_addr(self):
        with override_settings(VAULT_ADDR=""), mock.patch.dict("os.environ", {"VAULT_ADDR": ""}), mock.patch("connectors.vault.httpx.post") as post:
            token = vault.encrypt("s3cret")
            self.assertEqual(vault.decrypt(token), "s3cret")
        self.assertEqual(crypto.decrypt(token), "s3cret")
        post.assert_not_called()

    def test_roundtrip_via_transit_api(self):
        with mock.patch.dict("os.environ", VAULT_ENV), mock.patch("connectors.vault.httpx.post", side_effect=fake_vault) as post:
            token = vault.encrypt("pä55")
            self.assertTrue(token.startswith("vault:v1:"))
            self.assertEqual(vault.decrypt(token), "pä55")
        first = post.call_args_list[0]
        self.assertEqual(first.args[0], "http://vault:8200/v1/transit/encrypt/oydin-creds")
        self.assertEqual(first.kwargs["headers"], {"X-Vault-Token": "hvs.app"})
        self.assertNotIn("pä55", str(first.kwargs["json"]))

    def test_errors_are_codes_without_details(self):
        cases = [(httpx.ConnectError("http://vault:8200 hvs.app"), "unavailable"),
                 (httpx.Response(403, json={"errors": ["permission denied"]}), "denied"),
                 (httpx.Response(503, json={}), "unavailable"),
                 (httpx.Response(200, text="not json"), "unavailable")]
        for outcome, code in cases:
            with mock.patch.dict("os.environ", VAULT_ENV), mock.patch("connectors.vault.httpx.post", side_effect=[outcome]):
                with self.assertRaises(vault.VaultError) as ctx:
                    vault.encrypt("x")
            self.assertEqual(str(ctx.exception), code)
        with mock.patch.dict("os.environ", {"VAULT_ADDR": "http://vault:8200", "VAULT_TOKEN": ""}), override_settings(VAULT_TOKEN=""):
            with self.assertRaises(vault.VaultError):
                vault.encrypt("x")

    def test_vault_token_without_vault_addr_is_error(self):
        with override_settings(VAULT_ADDR=""), mock.patch.dict("os.environ", {"VAULT_ADDR": ""}):
            with self.assertRaises(vault.VaultError):
                vault.decrypt("vault:v1:eA==")

    def test_reveal_reencrypts_legacy_value_once(self):
        owner, business, _ = make_user("vault_owner")
        a = DidoxAccount.objects.create(business=business, tax_id="300000001", password_enc=crypto.encrypt("pa55"))
        with mock.patch.dict("os.environ", VAULT_ENV), mock.patch("connectors.vault.httpx.post", side_effect=fake_vault) as post:
            self.assertEqual(vault.reveal(a, "password_enc"), "pa55")
            a.refresh_from_db()
            self.assertTrue(a.password_enc.startswith("vault:v1:"))
            self.assertEqual(post.call_count, 1)
            self.assertEqual(vault.reveal(a, "password_enc"), "pa55")
            self.assertEqual(post.call_count, 2)  # только decrypt, повторного encrypt нет

    def test_reveal_keeps_legacy_value_when_vault_is_down(self):
        owner, business, _ = make_user("vault_owner2")
        legacy = crypto.encrypt("pa55")
        a = DidoxAccount.objects.create(business=business, tax_id="300000001", password_enc=legacy)
        with mock.patch.dict("os.environ", VAULT_ENV), mock.patch("connectors.vault.httpx.post", side_effect=httpx.ConnectError("x")):
            self.assertEqual(vault.reveal(a, "password_enc"), "pa55")
        a.refresh_from_db()
        self.assertEqual(a.password_enc, legacy)

    def test_reveal_does_not_overwrite_secret_saved_concurrently(self):
        owner, business, _ = make_user("vault_cas")
        a = DidoxAccount.objects.create(business=business, tax_id="300000001", password_enc=crypto.encrypt("old"))
        stale = DidoxAccount.objects.get(pk=a.pk)  # экземпляр, снятый до PATCH владельца

        def vault_after_concurrent_save(url, **kwargs):
            DidoxAccount.objects.filter(pk=a.pk).update(password_enc="vault:v1:bmV3")  # владелец сохранил новый секрет
            return fake_vault(url, **kwargs)

        with mock.patch.dict("os.environ", VAULT_ENV), mock.patch("connectors.vault.httpx.post", side_effect=vault_after_concurrent_save):
            self.assertEqual(vault.reveal(stale, "password_enc"), "old")
        a.refresh_from_db()
        self.assertEqual(a.password_enc, "vault:v1:bmV3")

    def test_malformed_vault_responses_become_codes(self):
        bad = [httpx.Response(200, json={"data": {}}), httpx.Response(200, json={"data": {"plaintext": "A"}}),
               httpx.Response(200, json={"data": {"plaintext": "/w=="}}), httpx.Response(200, json={"data": []})]
        for resp in bad:
            with mock.patch.dict("os.environ", VAULT_ENV), mock.patch("connectors.vault.httpx.post", side_effect=[resp]):
                with self.assertRaises(vault.VaultError) as ctx:
                    vault.decrypt("vault:v1:eA==")
            self.assertEqual(str(ctx.exception), "unavailable")
        with mock.patch.dict("os.environ", VAULT_ENV), mock.patch("connectors.vault.httpx.post", side_effect=[httpx.Response(200, json={"data": {}})]):
            with self.assertRaises(vault.VaultError):
                vault.encrypt("x")

    def test_invalid_url_and_stream_errors_are_wrapped(self):
        for exc in (httpx.InvalidURL("http://vault:8200 hvs.app"), httpx.StreamConsumed()):
            with mock.patch.dict("os.environ", VAULT_ENV), mock.patch("connectors.vault.httpx.post", side_effect=exc):
                with self.assertRaises(vault.VaultError) as ctx:
                    vault.encrypt("x")
            self.assertEqual(str(ctx.exception), "unavailable")
            with mock.patch("connectors.didox.httpx.request", side_effect=exc), override_settings(DIDOX_PARTNER_TOKEN="p"):
                with self.assertRaises(didox.DidoxError) as ctx:
                    didox.request("GET", "/x")
            self.assertEqual(str(ctx.exception), "unavailable")

    def test_require_vault_refuses_fernet_downgrade(self):
        with override_settings(VAULT_ADDR=""), mock.patch.dict("os.environ", {"VAULT_ADDR": "", "VAULT_REQUIRED": "1"}):
            with self.assertRaises(vault.VaultError) as ctx:
                vault.encrypt("s3cret")
        self.assertEqual(str(ctx.exception), "not_configured")

    def test_undecryptable_legacy_value_is_error_not_empty(self):
        with override_settings(VAULT_ADDR=""), mock.patch.dict("os.environ", {"VAULT_ADDR": ""}):
            with self.assertRaises(vault.VaultError) as ctx:
                vault.decrypt("not-a-fernet-token")
        self.assertEqual(str(ctx.exception), "undecryptable")

    def test_context_is_sent_and_bound_to_tenant_and_field(self):
        owner, business, _ = make_user("vault_ctx")
        a = DidoxAccount(business=business)
        ctx = vault.context(a, "password_enc")
        with mock.patch.dict("os.environ", VAULT_ENV), mock.patch("connectors.vault.httpx.post", side_effect=fake_vault) as post:
            vault.encrypt("x", ctx)
        self.assertEqual(post.call_args.kwargs["json"]["context"], ctx)
        self.assertNotEqual(ctx, vault.context(a, "auth_secret_enc"))

    def test_connector_secret_and_didox_password_stored_in_vault(self):
        owner, business, _ = make_user("vault_owner3")
        Membership.objects.update_or_create(user=owner, business=business, defaults={"role": "owner"})
        self.client.force_login(owner)
        with mock.patch.dict("os.environ", VAULT_ENV), mock.patch("connectors.vault.httpx.post", side_effect=fake_vault):
            with didox_http(reply(200, DIDOX_LOGIN)):
                r = self.client.put("/api/connectors/didox/", {"tax_id": "300000001", "password": "pa55"}, content_type="application/json")
            self.assertEqual(r.status_code, 200)
            self.assertTrue(DidoxAccount.objects.get().password_enc.startswith("vault:v1:"))

    def test_vault_down_on_save_is_503_and_stores_nothing(self):
        owner, business, _ = make_user("vault_owner4")
        Membership.objects.update_or_create(user=owner, business=business, defaults={"role": "owner"})
        self.client.force_login(owner)
        with mock.patch.dict("os.environ", VAULT_ENV), mock.patch("connectors.vault.httpx.post", side_effect=httpx.ConnectError("x")):
            with didox_http(reply(200, DIDOX_LOGIN)):
                r = self.client.put("/api/connectors/didox/", {"tax_id": "300000001", "password": "pa55"}, content_type="application/json")
        self.assertEqual((r.status_code, r.json()["error"]), (503, "vault_unavailable"))
        self.assertFalse(DidoxAccount.objects.exists())
