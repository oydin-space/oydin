from django.core.management import call_command
from django.test import TestCase

from accounts.models import Business
from finance.tests import add_member, jpost, make_user

from . import catalog, services
from .models import UsageEvent, WidgetConfig, WidgetProposal


class ModulesApiTests(TestCase):
    def setUp(self):
        self.owner, self.biz, _ = make_user("own")
        self.other, self.other_biz, _ = make_user("oth")
        self.seller = add_member(self.biz, "sel", "seller")
        self.client.force_login(self.owner)

    def put(self, url, body):
        return self.client.put(url, body, content_type="application/json")

    def test_modules_and_presets(self):
        mods = {m["key"]: m["enabled"] for m in self.client.get("/api/modules/").json()["modules"]}
        self.assertTrue(mods["money"] and not mods["warehouse"])
        r = self.put("/api/modules/", {"modules": {"warehouse": True, "debts": False}})
        self.assertEqual({m["key"]: m["enabled"] for m in r.json()["modules"]}["warehouse"], True)
        self.assertEqual(self.put("/api/modules/", {"modules": {"money": False}}).status_code, 400)
        self.assertEqual(self.put("/api/modules/", {"modules": {"x": True}}).status_code, 400)
        r = jpost(self.client, "/api/modules/preset/", {"preset": "services"})
        on = {m["key"] for m in r.json()["modules"] if m["enabled"]}
        self.assertEqual(on, set(catalog.PRESETS["services"]))
        self.assertEqual(jpost(self.client, "/api/modules/preset/", {"preset": "zzz"}).status_code, 400)

    def test_owner_only_demo_and_tenant(self):
        self.client.force_login(self.seller)
        self.assertEqual(self.client.get("/api/modules/").status_code, 403)
        self.assertEqual(self.client.get("/api/widgets/").status_code, 403)
        self.client.force_login(self.owner)
        Business.objects.filter(pk=self.biz.pk).update(is_demo=True)
        r = jpost(self.client, "/api/modules/preset/", {"preset": "shop"})
        self.assertEqual((r.status_code, r.json()["error"]), (403, "demo_tenant"))
        self.assertEqual(self.client.get("/api/modules/").status_code, 200)

    def test_widgets_follow_modules(self):
        keys = {w["key"] for w in self.client.get("/api/widgets/").json()["widgets"]}
        self.assertEqual(keys, {"money_summary", "debts_due", "people_cost", "suppliers_due"})
        self.put("/api/modules/", {"modules": {"people": False}})
        keys = {w["key"] for w in self.client.get("/api/widgets/").json()["widgets"]}
        self.assertNotIn("people_cost", keys)
        self.assertEqual(WidgetConfig.objects.filter(business=self.other_biz).count(), 0)

    def test_validator_rejects_outside_allowlist(self):
        good = dict(catalog.WIDGETS["money_summary"][1])
        catalog.validate_spec(good)
        for bad in ({**good, "sql": "select 1"}, {**good, "source": "users"}, {**good, "metric": "due"},
                    {**good, "size": "xl"}, {**good, "limit": 99}, {**good, "title": ""}, []):
            with self.assertRaises(Exception, msg=bad):
                catalog.validate_spec(bad)

    def test_usage_validation(self):
        self.assertEqual(jpost(self.client, "/api/widgets/usage/", {"key": "debts_due", "action": "open"}).status_code, 201)
        self.assertEqual(jpost(self.client, "/api/widgets/usage/", {"key": "nope", "action": "open"}).status_code, 400)
        self.assertEqual(jpost(self.client, "/api/widgets/usage/", {"key": "debts_due", "action": "x"}).status_code, 400)
        self.assertEqual(UsageEvent.objects.filter(business=self.biz).count(), 1)

    def _propose(self):
        self.client.get("/api/widgets/")
        for _ in range(6):
            jpost(self.client, "/api/widgets/usage/", {"key": "debts_due", "action": "open"})
        r = jpost(self.client, "/api/widgets/proposals/", {})
        self.assertEqual(r.status_code, 201)
        return r.json()["created"][0]

    def test_propose_approve_versions_rollback(self):
        p = self._propose()
        self.assertEqual((p["key"], p["spec"]["size"], p["base_version"]), ("debts_due", "l", 1))
        self.assertIn("6", p["rationale"])
        self.assertEqual(jpost(self.client, "/api/widgets/proposals/", {}).json()["created"], [])
        self.assertEqual(len(self.client.get("/api/widgets/proposals/").json()["proposals"]), 1)
        r = jpost(self.client, f"/api/widgets/proposals/{p['id']}/approve/", {})
        self.assertEqual(r.json()["status"], "approved")
        self.assertEqual(jpost(self.client, f"/api/widgets/proposals/{p['id']}/approve/", {}).status_code, 409)
        vs = self.client.get("/api/widgets/debts_due/versions/").json()["versions"]
        self.assertEqual([(v["version"], v["active"]) for v in vs], [(2, True), (1, False)])
        r = jpost(self.client, "/api/widgets/debts_due/rollback/", {"version": 1})
        self.assertEqual((r.json()["version"], r.json()["spec"]["size"]), (3, "m"))
        self.assertEqual(jpost(self.client, "/api/widgets/debts_due/rollback/", {"version": 9}).status_code, 404)
        self.assertEqual(WidgetConfig.objects.filter(business=self.biz, key="debts_due", active=True).count(), 1)

    def test_reject_and_stale_base(self):
        p = self._propose()
        self.assertEqual(jpost(self.client, f"/api/widgets/proposals/{p['id']}/reject/", {}).json()["status"], "rejected")
        self.assertEqual(jpost(self.client, f"/api/widgets/proposals/{p['id']}/reject/", {}).status_code, 409)
        stale = WidgetProposal.objects.create(business=self.biz, key="debts_due", base_version=1,
                                              spec={**catalog.WIDGETS["debts_due"][1], "size": "s"}, rationale="x")
        services.rollback(self.biz, "debts_due", 1)
        self.assertEqual(jpost(self.client, f"/api/widgets/proposals/{stale.id}/approve/", {}).status_code, 409)

    def test_cross_tenant_proposal_404(self):
        p = WidgetProposal.objects.create(business=self.other_biz, key="debts_due", base_version=1,
                                          spec=catalog.WIDGETS["debts_due"][1], rationale="x")
        self.assertEqual(jpost(self.client, f"/api/widgets/proposals/{p.id}/approve/", {}).status_code, 404)
        self.assertEqual(self.client.get("/api/widgets/debts_due/versions/").status_code, 404)

    def test_command(self):
        self.put("/api/modules/", {"modules": {"warehouse": True}})
        self.client.get("/api/widgets/")
        for _ in range(3):
            UsageEvent.objects.create(business=self.biz, key="stock_low", action="dismiss")
        UsageEvent.objects.create(business=self.biz, key="people_cost", action="dismiss")
        call_command("propose_widgets", business=self.biz.pk)
        made = WidgetProposal.objects.filter(business=self.biz)
        self.assertEqual([(p.key, p.spec["size"]) for p in made], [("stock_low", "s")])
