from finance.models import Product
from finance.tests import add_member, jpost, make_user
from finance.validation import MAX_AMOUNT

from django.test import TestCase


class ProductCreateTests(TestCase):
    def setUp(self):
        self.owner, self.biz, _ = make_user("own")
        self.client.force_login(self.owner)

    def post(self, **over):
        return jpost(self.client, "/api/products/", {"name": "Плов", "price": 30000, "unit_cost": 18000, **over})

    def test_create_ok_is_scoped_to_business(self):
        r = self.post(name="  Плов  ", cost_is_estimate=True)
        self.assertEqual(r.status_code, 201)
        product = Product.objects.get(id=r.json()["id"])
        self.assertEqual((product.business_id, product.name, product.price, product.unit_cost), (self.biz.id, "Плов", 30000, 18000))
        self.assertTrue(product.cost_is_estimate)
        listed = self.client.get("/api/products/").json()["items"]
        self.assertEqual([p["name"] for p in listed], ["Плов"])

    def test_cost_estimate_defaults_false(self):
        r = self.post()
        self.assertFalse(Product.objects.get(id=r.json()["id"]).cost_is_estimate)

    def test_validation(self):
        cases = {
            "invalid_name": [{"name": ""}, {"name": "   "}, {"name": 5}, {"name": "x" * 201}, {"name": None}],
            "invalid_price": [{"price": 0}, {"price": -1}, {"price": "100"}, {"price": 1.5}, {"price": True}, {"price": MAX_AMOUNT + 1}],
            "invalid_unit_cost": [{"unit_cost": -1}, {"unit_cost": "5"}, {"unit_cost": False}, {"unit_cost": MAX_AMOUNT + 1}],
        }
        for code, variants in cases.items():
            for over in variants:
                with self.subTest(over=over):
                    r = self.post(**over)
                    self.assertEqual(r.status_code, 400)
                    self.assertIn(code, r.content.decode())
        self.assertEqual(Product.objects.count(), 0)

    def test_missing_fields_rejected(self):
        self.assertEqual(jpost(self.client, "/api/products/", {"name": "Чай"}).status_code, 400)
        self.assertEqual(jpost(self.client, "/api/products/", {"price": 10, "unit_cost": 5}).status_code, 400)

    def test_zero_unit_cost_allowed(self):
        self.assertEqual(self.post(unit_cost=0).status_code, 201)

    def test_seller_cannot_create_and_sees_no_costs(self):
        seller = add_member(self.biz, "sel", "seller")
        Product.objects.create(business=self.biz, name="p", price=100, unit_cost=60)
        self.client.force_login(seller)
        self.assertEqual(self.post().status_code, 403)
        self.assertEqual(Product.objects.count(), 1)
        item = self.client.get("/api/products/").json()["items"][0]
        self.assertNotIn("unit_cost", item)

    def test_accountant_cannot_create(self):
        acc = add_member(self.biz, "acc", "accountant")
        self.client.force_login(acc)
        self.assertEqual(self.post().status_code, 403)

    def test_demo_tenant_forbidden(self):
        self.biz.is_demo = True
        self.biz.save(update_fields=["is_demo"])
        r = self.post()
        self.assertEqual(r.status_code, 403)
        self.assertIn("demo_tenant", r.content.decode())
        self.assertEqual(Product.objects.count(), 0)

    def test_anonymous_rejected(self):
        self.client.logout()
        self.assertIn(self.post().status_code, (401, 403))
