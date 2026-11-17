import json

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import Client, TestCase, override_settings
from django.urls import include, path

from accounts.models import Business, Membership, Profile
from finance.models import Account, Transaction

urlpatterns = [path("api/", include("publicapi.urls")), path("api/", include("finance.urls"))]


def setup_user(name, role="owner", business=None):
    user = get_user_model().objects.create(username=name)
    business = business or Business.objects.create(name=name)
    Profile.objects.create(user=user, business=business)
    Membership.objects.update_or_create(user=user, business=business, defaults={"role": role})
    return user, business


@override_settings(ROOT_URLCONF=__name__)
class SyncTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.business = setup_user("o")
        self.account = Account.objects.create(business=self.business, name="Касса", kind="cash")
        self.other_owner, self.other_business = setup_user("x")
        self.other_account = Account.objects.create(business=self.other_business, name="Касса", kind="cash")
        self.client = Client(enforce_csrf_checks=False)
        self.client.force_login(self.owner)

    def op(self, client_id, **over):
        payload = {"amount": 1000, "direction": "in", "category": "Розница", "account_id": self.account.id, **over}
        return {"client_id": client_id, "kind": "operation", "payload": payload}

    def sync(self, items, client=None):
        return (client or self.client).post("/api/sync/", json.dumps({"items": items}), content_type="application/json")

    def test_creates_in_order_with_offline_source(self):
        r = self.sync([self.op("a"), self.op("b", amount=2000)])
        results = r.json()["results"]
        self.assertEqual([x["status"] for x in results], ["created", "created"])
        self.assertEqual([x["client_id"] for x in results], ["a", "b"])
        tx = Transaction.objects.get(pk=results[0]["id"])
        self.assertEqual((tx.source, tx.status, tx.created_by), ("offline", "confirmed", self.owner))

    def test_replay_creates_no_duplicates(self):
        first = self.sync([self.op("a")]).json()["results"][0]
        again = self.sync([self.op("a")]).json()["results"][0]
        self.assertEqual(again["status"], "duplicate")
        self.assertEqual(again["id"], first["id"])
        self.assertEqual(Transaction.objects.count(), 1)

    def test_duplicate_inside_one_batch(self):
        results = self.sync([self.op("a"), self.op("a")]).json()["results"]
        self.assertEqual([r["status"] for r in results], ["created", "duplicate"])
        self.assertEqual(Transaction.objects.count(), 1)

    def test_item_errors_do_not_block_others(self):
        results = self.sync([self.op("a", amount=-5), self.op("b")]).json()["results"]
        self.assertEqual(results[0]["status"], "error")
        self.assertTrue(results[0]["error"])
        self.assertEqual(results[1]["status"], "created")
        # исправленная запись с тем же client_id применяется (ошибочная ничего не сохранила)
        self.assertEqual(self.sync([self.op("a")]).json()["results"][0]["status"], "created")

    def test_foreign_account_rejected(self):
        item = self.op("a", account_id=self.other_account.id)
        self.assertEqual(self.sync([item]).json()["results"][0]["status"], "error")
        self.assertEqual(Transaction.objects.count(), 0)

    def test_client_id_scoped_to_business(self):
        self.sync([self.op("same")])
        other = Client()
        other.force_login(self.other_owner)
        item = self.op("same", account_id=self.other_account.id)
        self.assertEqual(self.sync([item], other).json()["results"][0]["status"], "created")
        self.assertEqual(Transaction.objects.count(), 2)

    def test_seller_creates_but_cash_close_forbidden(self):
        seller, _ = setup_user("s", "seller", self.business)
        c = Client()
        c.force_login(seller)
        close = {"client_id": "c1", "kind": "cash_close", "payload": {"account_id": self.account.id, "counted": 5}}
        results = self.sync([self.op("a"), close], c).json()["results"]
        self.assertEqual(results[0]["status"], "created")
        self.assertEqual((results[1]["status"], results[1]["error"]), ("error", "forbidden"))

    def test_bad_batches(self):
        self.assertEqual(self.sync([]).status_code, 400)
        self.assertEqual(self.sync([self.op(str(i)) for i in range(101)]).status_code, 400)
        results = self.sync([{"kind": "operation"}, {"client_id": "z", "kind": "nope", "payload": {}}]).json()["results"]
        self.assertEqual([r["status"] for r in results], ["error", "error"])

    def test_requires_login_and_csrf(self):
        self.assertEqual(Client().post("/api/sync/", "{}", content_type="application/json").status_code, 401)
        guarded = Client(enforce_csrf_checks=True)
        guarded.force_login(self.owner)
        self.assertEqual(self.sync([self.op("a")], guarded).status_code, 403)
