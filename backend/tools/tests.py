from django.core.cache import cache
from django.test import TestCase

from accounts.models import Membership
from finance.tests import add_member, jpost, make_user

from . import builtins

SPEC = 'root = Stack([c])\nc = Calculator("Маржа", [p, q], [o])\np = MoneyField("price", "Цена", 20000)\nq = MoneyField("cost", "Себестоимость", 12000)\no = Output("Маржа", "price - cost", "money")'


class ToolsApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.business, _ = make_user("tools_owner")
        Membership.objects.update_or_create(user=self.owner, business=self.business, defaults={"role": "owner"})
        self.client.force_login(self.owner)

    def create(self, **extra):
        return jpost(self.client, "/api/tools/", {"title": "Маржа", "kind": "custom", "spec": SPEC, **extra})

    def patch(self, id, body):
        return self.client.patch(f"/api/tools/{id}/", body, content_type="application/json")

    def test_crud(self):
        r = self.create(values={"price": 25000})
        self.assertEqual(r.status_code, 201)
        tool = r.json()
        self.assertEqual((tool["kind"], tool["spec"], tool["values"], tool["pinned"]), ("custom", SPEC, {"price": 25000}, False))
        self.assertEqual([t["id"] for t in self.client.get("/api/tools/").json()], [tool["id"]])
        r = self.patch(tool["id"], {"title": "Кофе", "pinned": True, "values": {"cost": 9000}})
        self.assertEqual((r.json()["title"], r.json()["pinned"], r.json()["values"]), ("Кофе", True, {"cost": 9000}))
        self.assertEqual(self.client.get(f"/api/tools/{tool['id']}/").json()["title"], "Кофе")
        self.assertEqual(self.client.delete(f"/api/tools/{tool['id']}/").status_code, 200)
        self.assertEqual(self.client.get(f"/api/tools/{tool['id']}/").status_code, 404)

    def test_validation(self):
        self.assertEqual(self.create(spec='root = Stack([x])\nx = Evil()').json()["error"], "invalid_spec")
        self.assertEqual(self.create(spec='root = Stack([t])\nt = TextBlock("без калькулятора")').json()["error"], "invalid_spec")
        self.assertEqual(self.create(kind="tax").json()["error"], "unsupported_kind")
        self.assertEqual(self.create(title="").json()["error"], "invalid_title")
        self.assertEqual(self.create(values={"unknown": 1}).json()["error"], "invalid_values")
        tool = self.create().json()
        self.assertEqual(self.patch(tool["id"], {"pinned": "yes"}).status_code, 400)

    def test_spec_size_limit(self):
        big = SPEC + "\n" + "\n".join(f'z{i} = TextBlock("{"x" * 200}")' for i in range(400))
        r = self.create(spec=big)
        self.assertEqual((r.status_code, r.json()["error"]), (400, "invalid_spec"))

    def test_templates(self):
        items = self.client.get("/api/tools/templates/?lang=en").json()
        self.assertEqual([i["kind"] for i in items], builtins.KINDS)
        self.assertTrue(all(i["spec"].startswith("root = Stack") for i in items))

    def test_roles(self):
        add_member(self.business, "tools_acc", "accountant")
        add_member(self.business, "tools_seller", "seller")
        tool = self.create().json()
        from django.contrib.auth import get_user_model

        users = get_user_model().objects
        self.client.force_login(users.get(username="tools_acc"))
        self.assertEqual(self.client.get("/api/tools/").status_code, 200)
        self.assertEqual(self.patch(tool["id"], {"pinned": True}).status_code, 200)
        self.client.force_login(users.get(username="tools_seller"))
        for r in [self.client.get("/api/tools/"), self.create(), self.client.get(f"/api/tools/{tool['id']}/"),
                  self.client.get("/api/tools/templates/")]:
            self.assertEqual((r.status_code, r.json()["error"]), (403, "forbidden"))

    def test_tenant_isolation(self):
        tool = self.create().json()
        other, other_business, _ = make_user("tools_other")
        Membership.objects.update_or_create(user=other, business=other_business, defaults={"role": "owner"})
        self.client.force_login(other)
        self.assertEqual(self.client.get("/api/tools/").json(), [])
        self.assertEqual(self.client.get(f"/api/tools/{tool['id']}/").status_code, 404)
        self.assertEqual(self.patch(tool["id"], {"title": "x"}).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/tools/{tool['id']}/").status_code, 404)


class WhatIfBalanceTests(TestCase):
    def test_what_if_sums_balance_in_uzs(self):
        from finance.models import Account
        from finance import services as fin

        _, business, _ = make_user("whatif")
        Account.objects.create(business=business, name="USD", kind="bank", currency="USD", opening_balance=10000)
        accounts = fin.list_accounts(business)
        total = sum(a["balance_uzs"] for a in accounts)
        self.assertNotEqual(total, sum(a["balance"] for a in accounts))
        line = next(l for l in builtins.build("what_if_gap", business)["spec"].splitlines() if '"balance"' in l)
        self.assertTrue(line.endswith(f", {total})"), line)
