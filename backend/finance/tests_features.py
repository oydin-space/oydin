import json
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from django.urls import include, path

from accounts.models import Business, Membership, Profile
from finance import services as svc
from finance.models import Account, GapAlert, Obligation, Transaction
from planning.models import CashClose, TaxReserve
from publicapi.models import WebhookDelivery, WebhookEndpoint

urlpatterns = [path("api/", include("publicapi.urls")), path("api/", include("finance.urls"))]


def make(name="o"):
    user = get_user_model().objects.create(username=name)
    business = Business.objects.create(name=name)
    Profile.objects.create(user=user, business=business)
    Membership.objects.update_or_create(user=user, business=business, defaults={"role": "owner"})
    return user, business, Account.objects.create(business=business, name="Касса", kind="cash")


@override_settings(ROOT_URLCONF=__name__)
class FeatureTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user, self.business, self.cash = make()
        self.card = Account.objects.create(business=self.business, name="Карта", kind="card")
        self.client = Client()
        self.client.force_login(self.user)
        self.endpoint = WebhookEndpoint.objects.create(
            business=self.business, url="https://example.com/h", secret="s",
            events=["transaction.created", "transaction.confirmed", "gap.detected"],
        )

    def post(self, url, body, **kw):
        return self.client.post(url, json.dumps(body), content_type="application/json", **kw)

    def patch(self, url, body):
        return self.client.patch(url, json.dumps(body), content_type="application/json")

    def tx(self, **over):
        data = dict(business=self.business, account=self.cash, date=svc.today(), amount=1000, direction="in",
                    category="Розница", created_by=self.user)
        data.update(over)
        return Transaction.objects.create(**data)

    # 5 transfers
    def test_transfer_moves_both_balances(self):
        r = self.post("/api/transactions/", {"amount": 300, "direction": "transfer", "category": "Перевод",
                                             "account_id": self.cash.id, "to_account_id": self.card.id})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["to_account_id"], self.card.id)
        balances = svc.account_balances(self.business)
        self.assertEqual((balances[self.cash.id], balances[self.card.id]), (-300, 300))

    def test_transfer_validation(self):
        base = {"amount": 300, "direction": "transfer", "category": "Перевод", "account_id": self.cash.id}
        self.assertEqual(self.post("/api/transactions/", {**base, "to_account_id": self.cash.id}).status_code, 400)
        foreign = make("x")[2]
        self.assertEqual(self.post("/api/transactions/", {**base, "to_account_id": foreign.id}).status_code, 400)
        self.assertEqual(self.post("/api/transactions/", {**base, "direction": "in",
                                                          "to_account_id": self.card.id}).status_code, 400)

    # 6 patch draft
    def test_patch_draft_stays_draft_unless_status_sent(self):
        t = self.tx(status="draft")
        r = self.patch(f"/api/transactions/{t.id}/", {"note": "x"})
        self.assertEqual(r.json()["status"], "draft")
        r = self.patch(f"/api/transactions/{t.id}/", {"status": "confirmed"})
        self.assertEqual(r.json()["status"], "confirmed")
        self.assertEqual(self.patch(f"/api/transactions/{t.id}/", {"status": "bogus"}).status_code, 400)

    # 3 pulse
    def test_pulse_tax_reserved_and_cash_difference(self):
        self.tx(amount=10_000_000)
        before = svc.pulse(self.business)
        self.assertEqual((before["tax_reserved"], before["cash_difference"]), (0, 0))
        TaxReserve.objects.create(business=self.business, enabled=True, method="fixed", fixed_amount=1_000_000)
        CashClose.objects.create(business=self.business, account=self.cash, date=svc.today(), currency="UZS",
                                 expected=10_000_000, counted=9_900_000, difference=-100_000)
        after = svc.pulse(self.business)
        self.assertEqual(after["tax_reserved"], 1_000_000)
        self.assertEqual(after["cash_difference"], -100_000)
        self.assertEqual(after["safe_to_spend"], before["safe_to_spend"] - 1_000_000)

    # 9 events
    def test_events_on_create_and_confirm(self):
        with self.captureOnCommitCallbacks(execute=True):
            t = self.post("/api/transactions/", {"amount": 5, "direction": "in", "category": "c",
                                                 "account_id": self.cash.id}).json()
            d = self.tx(status="draft")
            self.patch(f"/api/transactions/{d.id}/", {"status": "confirmed"})
        events = list(WebhookDelivery.objects.values_list("event", flat=True))
        self.assertEqual(sorted(events), ["transaction.confirmed", "transaction.created"])
        self.assertTrue(t["id"])

    def test_gap_detected_once_per_date(self):
        Obligation.objects.create(business=self.business, title="Аренда", kind="rent", amount=5_000_000,
                                  due_date=svc.today() + timedelta(days=5))
        with self.captureOnCommitCallbacks(execute=True):
            svc.pulse(self.business)
            svc.pulse(self.business)
        self.assertEqual(GapAlert.objects.count(), 1)
        self.assertEqual(WebhookDelivery.objects.filter(event="gap.detected").count(), 1)

    # 2 cash_close sync
    def sync(self, items):
        return self.post("/api/sync/", {"items": items}).json()["results"]

    def test_cash_close_sync_idempotent(self):
        self.tx(amount=1000)
        item = {"client_id": "c1", "kind": "cash_close",
                "payload": {"account_id": self.cash.id, "counted": 900, "date": svc.today().isoformat()}}
        first = self.sync([item])[0]
        self.assertEqual(first["status"], "created")
        close = CashClose.objects.get()
        self.assertEqual((close.expected, close.difference, first["id"]), (1000, -100, close.id))
        self.assertEqual(self.sync([item])[0]["status"], "duplicate")
        again = {**item, "client_id": "c2"}
        self.assertEqual(self.sync([again])[0]["error"], "already_closed")
        self.assertEqual(CashClose.objects.count(), 1)

    def test_cash_close_sync_seller_forbidden(self):
        seller = get_user_model().objects.create(username="s")
        Profile.objects.create(user=seller, business=self.business)
        Membership.objects.update_or_create(user=seller, business=self.business, defaults={"role": "seller"})
        c = Client()
        c.force_login(seller)
        item = {"client_id": "z", "kind": "cash_close", "payload": {"account_id": self.cash.id, "counted": 1}}
        r = c.post("/api/sync/", json.dumps({"items": [item]}), content_type="application/json")
        self.assertEqual(r.json()["results"][0]["error"], "forbidden")


@override_settings(ROOT_URLCONF=__name__)
class AccountCrudTests(TestCase):
    def setUp(self):
        self.user, self.business, self.cash = make("acc")
        self.client = Client()
        self.client.force_login(self.user)

    def req(self, method, url, body=None, client=None):
        return getattr(client or self.client, method)(url, json.dumps(body or {}), content_type="application/json")

    def test_create_ok_and_defaults(self):
        r = self.req("post", "/api/accounts/", {"name": "Карта", "kind": "card", "currency": "USD"})
        self.assertEqual(r.status_code, 201, r.content)
        self.assertEqual(r.json()["balance"], 0)
        r = self.req("post", "/api/accounts/", {"name": "Банк", "kind": "bank", "currency": "UZS",
                                                "opening_balance": 5000})
        self.assertEqual((r.json()["balance"], r.json()["currency"]), (5000, "UZS"))

    def test_create_invalid(self):
        ok = {"name": "N", "kind": "cash", "currency": "UZS"}
        for bad in ({"name": " "}, {"kind": "x"}, {"currency": "EUR"}, {"opening_balance": -1},
                    {"opening_balance": "1"}, {"name": "касса"}):
            r = self.req("post", "/api/accounts/", {**ok, **bad})
            self.assertEqual(r.status_code, 400, bad)
        self.assertEqual(self.req("post", "/api/accounts/", {**ok, "name": "касса"}).json()["error"], "account_exists")

    def test_roles_and_demo(self):
        for role in ("accountant", "seller"):
            u = get_user_model().objects.create(username=role)
            Profile.objects.create(user=u, business=self.business)
            Membership.objects.update_or_create(user=u, business=self.business, defaults={"role": role})
            c = Client()
            c.force_login(u)
            r = self.req("post", "/api/accounts/", {"name": "Z", "kind": "cash", "currency": "UZS"}, c)
            self.assertEqual((r.status_code, r.json()["error"]), (403, "forbidden"))
            self.assertEqual(self.req("patch", f"/api/accounts/{self.cash.id}/", {"name": "Q"}, c).status_code, 403)
        Business.objects.filter(pk=self.business.pk).update(is_demo=True)
        r = self.req("post", "/api/accounts/", {"name": "Z", "kind": "cash", "currency": "UZS"})
        self.assertEqual(r.status_code, 403)

    def test_rename_and_delete(self):
        extra = Account.objects.create(business=self.business, name="Доп", kind="cash")
        r = self.req("patch", f"/api/accounts/{extra.id}/", {"name": "Новое"})
        self.assertEqual(r.json()["name"], "Новое")
        self.assertEqual(self.req("patch", f"/api/accounts/{extra.id}/", {"name": "Касса"}).json()["error"],
                         "account_exists")
        Transaction.objects.create(business=self.business, account=self.cash, date=svc.today(), amount=1,
                                   direction="in", category="c")
        r = self.req("delete", f"/api/accounts/{self.cash.id}/")
        self.assertEqual((r.status_code, r.json()["error"]), (409, "account_in_use"))
        self.assertEqual(self.req("delete", f"/api/accounts/{extra.id}/").status_code, 204)
        other = make("o2")[2]
        self.assertEqual(self.req("delete", f"/api/accounts/{other.id}/").status_code, 404)
