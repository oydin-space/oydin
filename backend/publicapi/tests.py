import hashlib
from datetime import timedelta
import hmac
import json
from unittest import mock

import httpx
from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from django.urls import include, path
from django.utils import timezone

from accounts.models import Business, Membership, Profile
from finance.models import Account, Transaction

from . import services as hooks
from . import ssrf
from .models import ApiToken, WebhookDelivery, WebhookEndpoint

urlpatterns = [path("api/", include("publicapi.urls")), path("api/", include("finance.urls"))]
PUBLIC = ["93.184.216.34"]


def make_business(name, role="owner"):
    user = get_user_model().objects.create(username=name)
    business = Business.objects.create(name=name)
    Profile.objects.create(user=user, business=business)
    Membership.objects.update_or_create(user=user, business=business, defaults={"role": role})
    account = Account.objects.create(business=business, name="Касса", kind="cash")
    return user, business, account


@override_settings(ROOT_URLCONF=__name__, CACHES={"default": {"BACKEND": "django.core.cache.backends.locmem.LocMemCache"}})
class ApiBase(TestCase):
    def setUp(self):
        cache.clear()
        self.user, self.business, self.account = make_business("a")
        self.user2, self.business2, self.account2 = make_business("b")
        self.session = Client(enforce_csrf_checks=True)
        self.session.force_login(self.user)

    def csrf_post(self, client, url, body, **extra):
        return client.post(url, json.dumps(body), content_type="application/json", **extra)

    def make_token(self, scopes=("read",)):
        from .auth import hash_token, new_token

        raw = new_token()
        t = ApiToken.objects.create(business=self.business, created_by=self.user, name="t", prefix=raw[:8],
                                    token_hash=hash_token(raw), scopes=list(scopes))
        return t, raw

    def bearer(self, raw):
        return {"HTTP_AUTHORIZATION": f"Bearer {raw}"}


class TokenManagementTests(ApiBase):
    def login_with_csrf(self):
        c = Client(enforce_csrf_checks=True)
        c.force_login(self.user)
        return c

    def test_session_views_keep_csrf(self):
        r = self.csrf_post(self.login_with_csrf(), "/api/developer/tokens/", {"name": "x"})
        self.assertEqual(r.status_code, 403)

    def create(self, body, client=None):
        c = client or Client()
        if client is None:
            c.force_login(self.user)
        return self.csrf_post(c, "/api/developer/tokens/", body)

    def test_create_shows_secret_once_and_stores_hash(self):
        r = self.create({"name": "erp", "scopes": ["read", "write"]})
        self.assertEqual(r.status_code, 201)
        raw = r.json()["token"]
        token = ApiToken.objects.get()
        self.assertNotIn(raw, token.token_hash)
        self.assertEqual(token.token_hash, hashlib.sha256(raw.encode()).hexdigest())
        self.assertEqual(token.prefix, raw[:8])
        listing = Client()
        listing.force_login(self.user)
        items = listing.get("/api/developer/tokens/").json()["items"]
        self.assertEqual(len(items), 1)
        self.assertNotIn("token", items[0])

    def test_validation(self):
        self.assertEqual(self.create({"scopes": ["read"]}).status_code, 400)
        self.assertEqual(self.create({"name": "x", "scopes": ["admin"]}).status_code, 400)

    def test_only_owner(self):
        acc = get_user_model().objects.create(username="acc")
        Profile.objects.create(user=acc, business=self.business)
        Membership.objects.update_or_create(user=acc, business=self.business, defaults={"role": "accountant"})
        c = Client()
        c.force_login(acc)
        self.assertEqual(self.create({"name": "x"}, c).status_code, 403)

    def test_revoke(self):
        t, raw = self.make_token()
        c = Client()
        c.force_login(self.user)
        self.assertEqual(c.delete(f"/api/developer/tokens/{t.id}/").status_code, 204)
        self.assertEqual(self.client.get("/api/v1/pulse/", **self.bearer(raw)).status_code, 401)
        self.assertEqual(c.get("/api/developer/tokens/").json()["items"], [])

    def test_cannot_revoke_foreign_token(self):
        t, _ = self.make_token()
        c = Client()
        c.force_login(self.user2)
        self.assertEqual(c.delete(f"/api/developer/tokens/{t.id}/").status_code, 404)


class BearerAuthTests(ApiBase):
    def test_ok_and_last_used(self):
        t, raw = self.make_token()
        r = self.client.get("/api/v1/accounts/", **self.bearer(raw))
        self.assertEqual(r.status_code, 200)
        t.refresh_from_db()
        self.assertIsNotNone(t.last_used_at)

    def test_missing_or_wrong_token(self):
        self.assertEqual(self.client.get("/api/v1/accounts/").status_code, 401)
        r = self.client.get("/api/v1/accounts/", HTTP_AUTHORIZATION="Bearer oyd_" + "x" * 30)
        self.assertEqual(r.status_code, 401)
        self.assertEqual(r.json(), {"error": "invalid_token"})

    def test_session_cookie_is_not_enough(self):
        self.assertEqual(self.session.get("/api/v1/accounts/").status_code, 401)

    def test_read_scope_cannot_write(self):
        _, raw = self.make_token(["read"])
        body = {"amount": 1000, "direction": "in", "category": "x", "account_id": self.account.id}
        r = self.csrf_post(self.client, "/api/v1/transactions/", body, **self.bearer(raw))
        self.assertEqual(r.status_code, 403)
        self.assertEqual(Transaction.objects.count(), 0)

    def test_tenant_isolation(self):
        _, raw = self.make_token(["read", "write"])
        Transaction.objects.create(business=self.business2, account=self.account2, amount=5, direction="in",
                                   category="secret", date=timezone.localdate())
        mine = self.client.get("/api/v1/transactions/", **self.bearer(raw)).json()["items"]
        self.assertEqual(mine, [])
        self.assertEqual([a["id"] for a in self.client.get("/api/v1/accounts/", **self.bearer(raw)).json()["items"]],
                         [self.account.id])
        body = {"amount": 1000, "direction": "in", "category": "x", "account_id": self.account2.id}
        r = self.csrf_post(self.client, "/api/v1/transactions/", body, **self.bearer(raw))
        self.assertEqual(r.status_code, 400)

    def test_create_is_draft_by_default_and_api_sourced(self):
        _, raw = self.make_token(["read", "write"])
        body = {"amount": 1000, "direction": "in", "category": "x", "account_id": self.account.id}
        r = self.csrf_post(self.client, "/api/v1/transactions/", body, **self.bearer(raw))
        self.assertEqual(r.status_code, 201)
        self.assertEqual((r.json()["status"], r.json()["source"]), ("draft", "api"))
        body["status"] = "confirmed"
        r = self.csrf_post(self.client, "/api/v1/transactions/", body, **self.bearer(raw))
        self.assertEqual(r.json()["status"], "confirmed")

    def test_pagination(self):
        _, raw = self.make_token()
        for i in range(3):
            Transaction.objects.create(business=self.business, account=self.account, amount=i + 1, direction="in",
                                       category="c", date=timezone.localdate())
        page = self.client.get("/api/v1/transactions/?limit=2", **self.bearer(raw)).json()
        self.assertEqual(len(page["items"]), 2)
        rest = self.client.get(f"/api/v1/transactions/?limit=2&cursor={page['next_cursor']}", **self.bearer(raw)).json()
        self.assertEqual(len(rest["items"]), 1)
        self.assertIsNone(rest["next_cursor"])

    @override_settings(PUBLICAPI_RATE_LIMIT=3)
    def test_rate_limit(self):
        _, raw = self.make_token()
        codes = [self.client.get("/api/v1/pulse/", **self.bearer(raw)).status_code for _ in range(5)]
        self.assertEqual(codes[:3], [200, 200, 200])
        self.assertEqual(codes[3:], [429, 429])
        _, other = self.make_token()
        self.assertEqual(self.client.get("/api/v1/pulse/", **self.bearer(other)).status_code, 200)


class IdempotencyTests(ApiBase):
    def post(self, raw, body, key):
        return self.csrf_post(self.client, "/api/v1/transactions/", body, HTTP_IDEMPOTENCY_KEY=key, **self.bearer(raw))

    def test_replay_returns_same_response_without_duplicate(self):
        _, raw = self.make_token(["read", "write"])
        body = {"amount": 1000, "direction": "in", "category": "x", "account_id": self.account.id}
        first = self.post(raw, body, "k1")
        second = self.post(raw, body, "k1")
        self.assertEqual((first.status_code, second.status_code), (201, 200))
        self.assertEqual(first.json(), second.json())
        self.assertEqual(Transaction.objects.count(), 1)

    def test_same_key_other_body_conflicts(self):
        _, raw = self.make_token(["read", "write"])
        body = {"amount": 1000, "direction": "in", "category": "x", "account_id": self.account.id}
        self.post(raw, body, "k1")
        r = self.post(raw, {**body, "amount": 2000}, "k1")
        self.assertEqual((r.status_code, r.json()), (409, {"error": "idempotency_conflict"}))

    def test_key_expires_after_24h(self):
        _, raw = self.make_token(["read", "write"])
        body = {"amount": 1000, "direction": "in", "category": "x", "account_id": self.account.id}
        self.post(raw, body, "k1")
        from .models import IdempotencyRecord

        IdempotencyRecord.objects.update(created_at=timezone.now() - timedelta(hours=25))
        self.assertEqual(self.post(raw, body, "k1").status_code, 201)  # истёк через 24ч
        self.assertEqual(Transaction.objects.count(), 2)


class SsrfTests(ApiBase):
    def check(self, url, addresses):
        with mock.patch.object(ssrf, "resolve", return_value=addresses):
            ssrf.check_url(url)

    def test_public_ok(self):
        self.check("https://example.com/hook", PUBLIC)

    def test_blocked(self):
        for url, addrs in [
            ("http://example.com/h", PUBLIC),
            ("https://localhost/h", ["127.0.0.1"]),
            ("https://x.test/h", ["10.0.0.5"]),
            ("https://x.test/h", ["192.168.1.1"]),
            ("https://x.test/h", ["169.254.169.254"]),
            ("https://x.test/h", ["::1"]),
            ("https://x.test/h", ["::ffff:127.0.0.1"]),
            ("https://x.test/h", PUBLIC + ["172.16.0.1"]),
            ("https://u:p@example.com/h", PUBLIC),
        ]:
            with self.subTest(url=url, addrs=addrs), self.assertRaises(ssrf.UnsafeUrl):
                self.check(url, addrs)

    def test_register_rejects_private_target(self):
        with mock.patch.object(ssrf, "resolve", return_value=["127.0.0.1"]):
            r = self.csrf_post(self.session_nocsrf(), "/api/developer/webhooks/",
                               {"url": "https://evil.test/h", "events": ["transaction.created"]})
        self.assertEqual((r.status_code, r.json()), (400, {"error": "private_address"}))
        self.assertEqual(WebhookEndpoint.objects.count(), 0)

    def session_nocsrf(self):
        c = Client()
        c.force_login(self.user)
        return c


class WebhookTests(ApiBase):
    def setUp(self):
        super().setUp()
        self.endpoint = WebhookEndpoint.objects.create(
            business=self.business, url="https://hooks.example.com/x", events=["transaction.created"], secret="whsec_s")
        patcher = mock.patch.object(ssrf, "resolve", return_value=PUBLIC)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_register_returns_secret_once(self):
        c = Client()
        c.force_login(self.user)
        r = self.csrf_post(c, "/api/developer/webhooks/", {"url": "https://b.example.com/h", "events": ["gap.detected"]})
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.json()["secret"])
        listing = c.get("/api/developer/webhooks/").json()["items"]
        self.assertTrue(all("secret" not in i for i in listing))

    def test_emit_queues_only_subscribed_own_business(self):
        WebhookEndpoint.objects.create(business=self.business2, url="https://o.example.com/", events=["transaction.created"], secret="s")
        WebhookEndpoint.objects.create(business=self.business, url="https://g.example.com/", events=["gap.detected"], secret="s")
        with self.captureOnCommitCallbacks(execute=True):
            tx = Transaction.objects.create(business=self.business, account=self.account, amount=7, direction="in",
                                            category="c", date=timezone.localdate())
            hooks.emit("transaction.created", tx)
        d = WebhookDelivery.objects.get()
        self.assertEqual(d.endpoint, self.endpoint)
        self.assertEqual(json.loads(d.body)["data"]["id"], tx.id)

    def deliver(self, response):
        self.endpoint.events = ["gap.detected"]
        self.endpoint.save()
        with self.captureOnCommitCallbacks(execute=True):
            hooks.emit("gap.detected", {"date": "2026-01-01", "shortfall": 1, "obligation_id": None}, self.business)
        with mock.patch.object(hooks.httpx, "post", return_value=response) as post:
            hooks.deliver_due()
        return post

    def test_signature_verifiable(self):
        post = self.deliver(httpx.Response(200))
        kwargs = post.call_args.kwargs
        h, body = kwargs["headers"], kwargs["content"]
        expected = hmac.new(b"whsec_s", f"{h['X-Oydin-Timestamp']}.".encode() + body, hashlib.sha256).hexdigest()
        self.assertEqual(h["X-Oydin-Signature"], "sha256=" + expected)
        self.assertEqual(h["X-Oydin-Event"], "gap.detected")
        self.assertFalse(kwargs["follow_redirects"])
        d = WebhookDelivery.objects.get()
        self.assertEqual((d.status, d.attempts, d.response_status), ("delivered", 1, 200))
        self.assertEqual(h["X-Oydin-Delivery"], str(d.delivery_id))

    def test_retry_backoff_then_fail(self):
        self.deliver(httpx.Response(500))
        d = WebhookDelivery.objects.get()
        self.assertEqual((d.status, d.attempts), ("pending", 1))
        delta = (d.next_attempt_at - timezone.now()).total_seconds()
        self.assertTrue(50 < delta <= 60)
        waits = []
        for _ in range(3):
            WebhookDelivery.objects.update(next_attempt_at=timezone.now())
            with mock.patch.object(hooks.httpx, "post", return_value=httpx.Response(500)):
                hooks.deliver_due()
            d.refresh_from_db()
            if d.next_attempt_at:
                waits.append(round((d.next_attempt_at - timezone.now()).total_seconds() / 60))
        self.assertEqual(waits, [10, 60])
        self.assertEqual((d.status, d.attempts), ("failed", 4))

    def test_network_error_retries(self):
        with self.captureOnCommitCallbacks(execute=True):
            hooks.emit("transaction.created", {"x": 1}, self.business)
        with mock.patch.object(hooks.httpx, "post", side_effect=httpx.ConnectError("boom")):
            hooks.deliver_due()
        d = WebhookDelivery.objects.get()
        self.assertEqual((d.status, d.attempts, d.response_status), ("pending", 1, None))

    def test_delivery_to_private_address_never_sent(self):
        with self.captureOnCommitCallbacks(execute=True):
            hooks.emit("transaction.created", {"x": 1}, self.business)
        with mock.patch.object(ssrf, "resolve", return_value=["10.0.0.1"]), \
                mock.patch.object(hooks.httpx, "post") as post:
            hooks.deliver_due()
        post.assert_not_called()
        self.assertEqual(WebhookDelivery.objects.get().status, "failed")

    def test_ping(self):
        c = Client()
        c.force_login(self.user)
        with mock.patch.object(hooks.httpx, "post", return_value=httpx.Response(204)):
            r = self.csrf_post(c, f"/api/developer/webhooks/{self.endpoint.id}/ping/", {})
        self.assertEqual(r.json(), {"status": 204})

    def test_ping_foreign_endpoint_404(self):
        c = Client()
        c.force_login(self.user2)
        self.assertEqual(self.csrf_post(c, f"/api/developer/webhooks/{self.endpoint.id}/ping/", {}).status_code, 404)

    def test_management_command(self):
        from django.core.management import call_command

        with self.captureOnCommitCallbacks(execute=True):
            hooks.emit("transaction.created", {"x": 1}, self.business)
        with mock.patch.object(hooks.httpx, "post", return_value=httpx.Response(200)):
            call_command("deliver_webhooks")
        self.assertEqual(WebhookDelivery.objects.get().status, "delivered")
