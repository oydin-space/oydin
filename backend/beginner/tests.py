from django.test import TestCase

from accounts.models import Business
from finance.tests import add_member, jpost, make_user

from . import services as svc

URL = "/api/beginner/plan/"


class BeginnerApiTests(TestCase):
    def setUp(self):
        self.owner, self.biz, _ = make_user("bown")
        self.other, self.other_biz, _ = make_user("both")
        self.seller = add_member(self.biz, "bsel", "seller")
        self.client.force_login(self.owner)

    def put(self, body):
        return self.client.put(URL, body, content_type="application/json")

    def test_empty_plan_and_persist(self):
        r = self.client.get(URL).json()
        self.assertEqual((r["budget_items"], r["totals"]["monthly"]), ([], 0))
        self.assertEqual(len(r["registration"]["forms"]), 3)
        self.put({"budget_items": [{"name": "Касса", "kind": "one_off", "amount": "2000000"},
                                   {"name": "Аренда", "kind": "monthly", "amount": 3000000}],
                  "checklist": ["budget"], "regime": "yatt"})
        r = self.client.get(URL).json()
        self.assertEqual(r["totals"], {"one_off": 2000000, "monthly": 3000000})
        self.assertEqual((r["checklist"], r["regime"]), (["budget"], "yatt"))

    def test_break_even_formula(self):
        r = self.put({"breakeven": {"price": 10000, "unit_cost": 4000, "fixed_monthly": 3100000}}).json()
        self.assertEqual(r["breakeven_result"], {"margin": 6000, "units": 517, "revenue": 5170000})
        r = self.put({"breakeven": {"price": 4000, "unit_cost": 4000, "fixed_monthly": 1}}).json()
        self.assertIsNone(r["breakeven_result"]["units"])
        self.assertIsNone(svc.break_even({"price": 5, "unit_cost": None, "fixed_monthly": 1})["units"])

    def test_validation(self):
        for bad in ({"budget_items": [{"name": "", "kind": "monthly", "amount": 1}]},
                    {"budget_items": [{"name": "a", "kind": "x", "amount": 1}]},
                    {"budget_items": [{"name": "a", "kind": "monthly", "amount": -1}]},
                    {"budget_items": [{"name": "a", "kind": "monthly", "amount": "abc"}]},
                    {"breakeven": {"price": "1e99"}}, {"checklist": ["nope"]}, {"regime": "ooo"}):
            self.assertEqual(self.put(bad).status_code, 400, bad)

    def test_tenant_isolation(self):
        self.put({"regime": "mchj"})
        self.client.force_login(self.other)
        self.assertEqual(self.client.get(URL).json()["regime"], "")

    def test_roles_and_demo(self):
        self.client.force_login(self.seller)
        self.assertEqual(self.client.get(URL).status_code, 403)
        self.assertEqual(self.client.get(URL + "pdf/").status_code, 403)
        self.client.force_login(self.owner)
        Business.objects.filter(pk=self.biz.pk).update(is_demo=True)
        r = self.put({"regime": "yatt"})
        self.assertEqual((r.status_code, r.json()["error"]), (403, "demo_tenant"))

    def test_pdf(self):
        self.put({"budget_items": [{"name": "Касса", "kind": "one_off", "amount": 1000}]})
        for lang in ("ru", "uz", "en"):
            r = self.client.get(URL + f"pdf/?lang={lang}")
            self.assertEqual(r.status_code, 200)
            self.assertTrue(r.content.startswith(b"%PDF"))
