from django.core.cache import cache
from django.test import TestCase

from accounts.models import Membership
from finance.tests import jpost, make_user

from . import builtins


class ToolsL10nTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.business, _ = make_user("tools_l10n")
        Membership.objects.update_or_create(user=self.owner, business=self.business, defaults={"role": "owner"})
        self.client.force_login(self.owner)

    def save_template(self, kind, title=None):
        t = builtins.build(kind, self.business, "ru")
        r = jpost(self.client, "/api/tools/", {"title": title or t["title"], "kind": kind, "spec": t["spec"]})
        self.assertEqual(r.status_code, 201)
        return r.json()["id"]

    def get(self, id, lang):
        return self.client.get(f"/api/tools/{id}/", HTTP_ACCEPT_LANGUAGE=lang).json()

    def test_template_tool_follows_request_language(self):
        id = self.save_template("what_if_gap")
        for lang in ("uz", "en", "ru"):
            expected = builtins.build("what_if_gap", self.business, lang)
            got = self.get(id, lang)
            self.assertEqual((got["title"], got["spec"]), (expected["title"], expected["spec"]))
        self.assertIn("Cash lasts", self.get(id, "en")["spec"])
        self.assertNotIn("Хватит", self.get(id, "en")["spec"])
        listed = self.client.get("/api/tools/?lang=uz").json()
        self.assertEqual(listed[0]["title"], builtins.tr("what_if_gap", "uz"))
        self.assertEqual(self.client.get(f"/api/tools/{id}/?lang=en", HTTP_ACCEPT_LANGUAGE="uz").json()["title"], "What if: cash gap")

    def test_all_templates_localize(self):
        ids = {kind: self.save_template(kind) for kind in builtins.KINDS}
        for lang in ("uz", "en"):
            for kind, id in ids.items():
                self.assertEqual(self.get(id, lang)["spec"].splitlines()[1:], builtins.build(kind, self.business, lang)["spec"].splitlines()[1:], kind)

    def test_texts_complete(self):
        for key, texts in builtins.T.items():
            self.assertTrue(all(texts) and len(texts) == 3, key)
            self.assertNotIn("'", texts[1], key)

    def test_envelope_title_keeps_user_name(self):
        id = self.save_template("envelope_plan_fact", "Конверт: план и факт: Налог")
        self.assertEqual(self.get(id, "uz")["title"], "Konvert: reja va fakt: Налог")
        self.assertEqual(self.get(id, "en")["title"], "Envelope: plan vs actual: Налог")

    def test_renamed_title_preserved(self):
        id = self.save_template("loan", "Мой кредит")
        got = self.get(id, "en")
        self.assertEqual(got["title"], "Мой кредит")
        self.assertIn("Loan amount", got["spec"])

    def test_custom_tool_untouched(self):
        spec = 'root = Stack([c])\nc = Calculator("Маржа", [p], [o])\np = MoneyField("price", "Цена", 1)\no = Output("Маржа", "price", "money")'
        r = jpost(self.client, "/api/tools/", {"title": "Маржа", "kind": "custom", "spec": spec}).json()
        got = self.get(r["id"], "en")
        self.assertEqual((got["title"], got["spec"]), ("Маржа", spec))


class ToolsQueryTests(ToolsL10nTests):
    def test_list_query_count_independent_of_tools(self):
        for kind in builtins.KINDS:
            self.save_template(kind)
        with self.assertNumQueries(self.baseline()):
            self.client.get("/api/tools/?lang=uz")

    def baseline(self):
        from django.db import connection
        from django.test.utils import CaptureQueriesContext

        with CaptureQueriesContext(connection) as ctx:
            self.client.get("/api/tools/?lang=uz")
        n = len(ctx)
        self.assertLessEqual(n, 6)
        return n

    def test_limit_enforced(self):
        from .models import SavedTool
        spec = builtins.build("loan", None, "ru")["spec"]
        SavedTool.objects.bulk_create([SavedTool(business=self.business, title="t", kind="loan", spec=spec) for _ in range(50)])
        r = jpost(self.client, "/api/tools/", {"title": "x", "kind": "loan", "spec": spec})
        self.assertEqual((r.status_code, r.json()["error"]), (409, "tools_limit"))
