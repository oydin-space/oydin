import json
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from django.urls import include, path

from accounts.models import Business, Membership, Profile
from finance import services as svc
from finance.models import Account, Transaction
from planning.models import CashClose, Commitment

urlpatterns = [path("api/", include("publicapi.urls")), path("api/", include("finance.urls"))]


@override_settings(ROOT_URLCONF=__name__)
class ReviewFixTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create(username="rv")
        self.business = Business.objects.create(name="rv")
        Profile.objects.create(user=self.user, business=self.business)
        Membership.objects.update_or_create(user=self.user, business=self.business, defaults={"role": "owner"})
        self.uzs = Account.objects.create(business=self.business, name="Сум", kind="cash")
        self.usd = Account.objects.create(business=self.business, name="Доллар", kind="bank", currency="USD")
        self.uzs2 = Account.objects.create(business=self.business, name="Сум 2", kind="card")
        self.client = Client()
        self.client.force_login(self.user)

    def send(self, method, url, body):
        return getattr(self.client, method)(url, json.dumps(body), content_type="application/json")

    def transfer(self, to):
        return {"amount": 1000, "direction": "transfer", "category": "Перевод", "account_id": self.uzs.id,
                "to_account_id": to.id}

    def test_transfer_currency_mismatch_post_patch_sync(self):
        r = self.send("post", "/api/transactions/", self.transfer(self.usd))
        self.assertEqual((r.status_code, r.json()["error"]), (400, "transfer_currency_mismatch"))
        ok = self.send("post", "/api/transactions/", self.transfer(self.uzs2))
        self.assertEqual(ok.status_code, 201)
        r = self.send("patch", f"/api/transactions/{ok.json()['id']}/", {"to_account_id": self.usd.id})
        self.assertEqual((r.status_code, r.json()["error"]), (400, "transfer_currency_mismatch"))
        r = self.send("post", "/api/sync/", {"items": [{"client_id": "c1", "kind": "operation",
                                                         "payload": self.transfer(self.usd)}]})
        self.assertEqual(r.json()["results"][0]["error"], "transfer_currency_mismatch")

    def test_account_delete_blocked_by_planning(self):
        self.assertEqual(self.client.delete(f"/api/accounts/{self.uzs2.id}/").status_code, 204)
        CashClose.objects.create(business=self.business, account=self.uzs, date=svc.today(), currency="UZS",
                                 expected=0, counted=0, difference=0)
        r = self.client.delete(f"/api/accounts/{self.uzs.id}/")
        self.assertEqual((r.status_code, r.json()["error"]), (409, "account_in_use"))
        Commitment.objects.create(business=self.business, account=self.usd, title="Аренда", category="Аренда",
                                  amount=5, frequency="weekly", next_date=svc.today())
        r = self.client.delete(f"/api/accounts/{self.usd.id}/")
        self.assertEqual((r.status_code, r.json()["error"]), (409, "account_in_use"))

    def test_non_string_values_return_400(self):
        r = self.send("post", "/api/accounts/", {"name": "X", "kind": [], "currency": "UZS"})
        self.assertEqual((r.status_code, r.json()["error"]), (400, "invalid_kind"))
        r = self.send("post", "/api/accounts/", {"name": "X", "kind": "cash", "currency": {}})
        self.assertEqual((r.status_code, r.json()["error"]), (400, "invalid_currency"))
        tx = Transaction.objects.create(business=self.business, account=self.uzs, date=svc.today(), amount=1,
                                        direction="in", category="c", created_by=self.user)
        self.assertEqual(self.send("patch", f"/api/transactions/{tx.id}/", {"status": []}).status_code, 400)
        body = {"items": [{"client_id": "c2", "kind": "operation", "payload": {
            "amount": 1, "direction": "in", "category": "c", "account_id": self.uzs.id, "status": []}}]}
        self.assertEqual(self.send("post", "/api/sync/", body).json()["results"][0]["error"], "invalid_status")

    def test_forecast_builds_bundle_once_for_90_days(self):
        with mock.patch.object(svc, "bundle", wraps=svc.bundle) as m:
            svc.forecast_points(self.business, 90)
        self.assertEqual(m.call_count, 1)

    def test_confirm_draft(self):
        tx = Transaction.objects.create(business=self.business, account=self.uzs, date=svc.today(), amount=1,
                                        direction="in", category="c", status="draft", created_by=self.user)
        with mock.patch("publicapi.services.emit") as emit:
            out = svc.confirm_draft(tx)
        self.assertEqual(out.status, "confirmed")
        emit.assert_called_once_with("transaction.confirmed", out)
        tx.refresh_from_db()
        self.assertEqual(tx.status, "confirmed")

    def test_sync_business_mismatch(self):
        item = {"client_id": "bm1", "kind": "operation", "payload": {
            "amount": 1, "direction": "in", "category": "c", "account_id": self.uzs.id}}
        for bad in (self.business.id + 1, "x", True):
            r = self.send("post", "/api/sync/", {"business_id": bad, "items": [item]})
            self.assertEqual((r.status_code, r.json()["error"]), (409, "business_mismatch"))
        self.assertFalse(Transaction.objects.filter(business=self.business).exists())
        r = self.send("post", "/api/sync/", {"business_id": self.business.id, "items": [item]})
        self.assertEqual(r.json()["results"][0]["status"], "created")
