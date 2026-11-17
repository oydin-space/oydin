from django.test import TestCase

from accounts.models import Business
from finance.models import Account, Order, Product, Transaction
from finance.tests import add_member, jpost, make_user, D


class FinanceSecurityTests(TestCase):
    def setUp(self):
        self.owner, self.biz, self.account = make_user("own")
        self.seller = add_member(self.biz, "sel", "seller")
        Product.objects.create(business=self.biz, name="p", price=100, unit_cost=60)
        Order.objects.create(business=self.biz, client="c", channel="retail", total=1, prepaid=0, due_date=D)

    def body(self, purpose, direction="in", **extra):
        return {"amount": 1000, "direction": direction, "category": "x", "purpose": purpose,
                "account_id": self.account.id, **extra}

    def test_seller_cannot_use_owner_purposes(self):
        self.client.force_login(self.seller)
        self.assertEqual(jpost(self.client, "/api/transactions/", self.body("owner_draw", "out")).status_code, 403)
        self.assertEqual(jpost(self.client, "/api/transactions/", self.body("owner_contribution")).status_code, 403)
        ok = jpost(self.client, "/api/transactions/", self.body("business"))
        self.assertEqual(ok.status_code, 201)
        r = self.client.patch(f"/api/transactions/{ok.json()['id']}/", {"purpose": "owner_draw", "direction": "out"},
                              content_type="application/json")
        self.assertEqual(r.status_code, 403)

    def test_owner_can_use_owner_purposes(self):
        self.client.force_login(self.owner)
        self.assertEqual(jpost(self.client, "/api/transactions/", self.body("owner_draw", "out")).status_code, 201)

    def test_seller_transfer_not_merged(self):
        other = Account.objects.create(business=self.biz, name="Карта", kind="card")
        self.client.force_login(self.seller)
        for acc, direction in ((self.account, "out"), (other, "in")):
            r = jpost(self.client, "/api/transactions/", {
                "amount": 500, "direction": direction, "category": "t", "purpose": "business", "account_id": acc.id,
            })
            self.assertEqual(r.status_code, 201)
        self.assertEqual(Transaction.objects.filter(business=self.biz, direction="transfer").count(), 0)
        self.assertEqual(Transaction.objects.filter(business=self.biz).count(), 2)

    def test_orders_gated_for_seller(self):
        self.client.force_login(self.seller)
        self.assertEqual(self.client.get("/api/orders/").status_code, 403)
        self.client.force_login(self.owner)
        self.assertEqual(len(self.client.get("/api/orders/").json()["items"]), 1)

    def test_products_hide_costs_from_seller(self):
        self.client.force_login(self.seller)
        item = self.client.get("/api/products/").json()["items"][0]
        for key in ("unit_cost", "margin_pct", "markup_pct"):
            self.assertNotIn(key, item)
        self.assertEqual(item["price"], 100)
        self.client.force_login(self.owner)
        item = self.client.get("/api/products/").json()["items"][0]
        self.assertEqual(item["unit_cost"], 60)
