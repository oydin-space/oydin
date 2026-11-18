import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings

from accounts.consent import set_consent
from accounts.models import Business, Membership, Profile
from ai import llm, memory
from ai.models import BusinessProfile, MemoryFact

from . import agent, flow, registry
from .models import OnboardingSession, RegistryLookup, UserProfile

SEARCH_HTML = """
<a href="/ru/organization/abc123/" class="text-decoration-none og-card"><div>
<span class="badge rounded-5">203366731</span><small>10.08.2000</small>
<h6 class="card-title">ООО «ТЕКСТИЛЬ ПРИНТ»</h6><p class="text-body-tertiary mb-0">Ташкент, Чиланзар</p></div></a>
"""
MULTI_HTML = SEARCH_HTML + SEARCH_HTML.replace("abc123", "def456").replace("203366731", "301111111").replace("ТЕКСТИЛЬ", "ВЕБ")
ORG_HTML = """
<h1 class="h1-seo">ООО «ТЕКСТИЛЬ ПРИНТ»</h1>
<div>Дата регистрации</div><div>10.08.2000</div><div>Статус</div><div>Активный</div>
<div>ИНН</div><div>203366731</div><div>ОКЭД</div><div>13300 -</div><div>Отделка тканей</div>
<div>Адрес</div><div>Ташкент</div><div>ул. Навои, 1</div>
<div>Руководитель</div><div>XASANOV NAZIRJON</div><div>Статус</div><div>Глоссарий</div>
"""


def post(client, url, body):
    return client.post(url, json.dumps(body), content_type="application/json")


class RegistryParsingTests(SimpleTestCase):
    def test_classify(self):
        self.assertEqual(registry.classify("203 366 731"), ("inn", "203366731"))
        self.assertEqual(registry.classify("12345678901234")[0], "pinfl")
        self.assertEqual(registry.classify("Текстиль Принт"), ("name", "Текстиль Принт"))
        self.assertEqual(registry.classify("12"), (None, ""))

    def test_parse_search_and_org(self):
        cards = registry.parse_search(SEARCH_HTML)
        self.assertEqual(cards[0][0], "/ru/organization/abc123/")
        self.assertEqual(cards[0][1]["inn"], "203366731")
        self.assertEqual(cards[0][1]["address"], "Ташкент, Чиланзар")
        org = registry.parse_organization(ORG_HTML)
        self.assertEqual(org["status"], "Активный")
        self.assertEqual(org["oked"], "13300")
        self.assertEqual(org["activity"], "Отделка тканей")
        self.assertEqual(org["director"], "XASANOV NAZIRJON")
        self.assertEqual(org["address"], "Ташкент, ул. Навои, 1")


def make_user(username, email=""):
    user = get_user_model().objects.create(username=username, email=email)
    Profile.objects.create(user=user)
    return user


class Base(TestCase):
    def setUp(self):
        cache.clear()
        self.user = make_user("newbie", "new@example.com")
        self.client.force_login(self.user)

    def submit(self, step, value=None, action="submit"):
        return post(self.client, "/api/onboarding/answer/", {"step": step, "action": action, "value": value})

    def walk_owner(self):
        self.assertEqual(self.submit("consent", {"ai": False, "language": "uz"}).status_code, 200)
        self.assertEqual(self.submit("name", {"first_name": "Dilnoza", "last_name": "Karimova"}).status_code, 200)
        self.assertEqual(
            self.submit("contact", {"phone": "90 123 45 67", "telegram": "@dilnoza_k", "channel": "telegram"}).status_code, 200
        )
        self.assertEqual(self.submit("business", {"name": "Dilnoza Print", "city": "Tashkent", "inn": "203366731"}).status_code, 200)


@patch.object(llm, "is_configured", return_value=False)
class FlowTests(Base):
    def test_new_user_forced(self, _):
        data = self.client.get("/api/onboarding/state/").json()
        self.assertFalse(data["done"])
        self.assertEqual(data["step"], "consent")
        self.assertEqual(data["progress"]["total"], len(flow.STEPS))

    def test_existing_user_also_forced_and_resumes(self, _):
        business = Business.objects.create(name="Old")
        Membership.objects.create(user=self.user, business=business, role="owner")
        set_consent(self.user, "ai", True)
        data = self.client.get("/api/onboarding/state/").json()
        self.assertFalse(data["done"])
        self.assertEqual(data["steps"]["consent"], "done")
        self.assertEqual(data["step"], "name")
        self.submit("name", {"first_name": "Ali"})
        self.assertEqual(self.client.get("/api/onboarding/state/").json()["step"], "contact")
        self.assertEqual(self.submit("business", {"keep": True}).status_code, 200)

    def test_demo_is_done(self, _):
        business = Business.objects.create(name="Demo", is_demo=True)
        Membership.objects.create(user=self.user, business=business, role="owner")
        self.assertTrue(self.client.get("/api/onboarding/state/").json()["done"])

    def test_full_owner_flow_persists_and_visible_in_context(self, _):
        self.walk_owner()
        membership = Membership.objects.get(user=self.user)
        self.assertEqual(membership.role, "owner")
        self.assertEqual(BusinessProfile.objects.get(business=membership.business).inn, "203366731")
        self.assertEqual(UserProfile.objects.get(user=self.user).phone, "+998901234567")
        self.submit("activity", {"activities": ["clothing", "other"], "other": "Печать на футболках", "team_size": "2_5"})
        self.submit("pains", {"tags": ["cash_gaps", "debts"]})
        self.submit("goals", {"tags": ["see_profit"]})
        self.submit("upload", {"source": "zero"})
        self.submit("invite", action="skip")
        self.submit("install", {"installed": False})
        self.submit("tour", {"brief_time": "08:30"})
        done = self.submit("summary", {}).json()
        self.assertTrue(done["done"])
        self.assertTrue(flow.is_done(self.user))
        ctx = memory.get_context(membership.business, self.user, "owner")
        texts = " | ".join(f["text"] for f in ctx["memory"])
        self.assertIn("кассовые разрывы", texts)
        self.assertIn("+998901234567", texts)
        self.assertIn("08:30", texts)
        self.assertEqual(ctx["business"]["activity"], "Одежда и текстиль, Печать на футболках")
        self.assertEqual(membership.business.__class__.objects.get(pk=membership.business.pk).segment, "textile_print")
        self.assertIn("видеть реальную прибыль", ctx["business"]["plans"])
        self.assertEqual(self.client.get("/api/onboarding/context/").json()["business"]["inn"], "203366731")

    def test_resubmit_replaces_fact(self, _):
        self.walk_owner()
        self.submit("pains", {"tags": ["debts"]})
        self.submit("pains", {"tags": ["taxes"]})
        facts = MemoryFact.objects.filter(source="onboarding", text__startswith="Главные боли")
        self.assertEqual([f.text for f in facts], ["Главные боли: налоги и отчётность"])

    def test_required_and_validation(self, _):
        self.assertEqual(self.submit("name", action="skip").json()["error"], "step_required")
        self.assertEqual(self.submit("contact", {"phone": "123"}).json()["error"], "invalid_phone")
        self.assertEqual(self.submit("summary", {}).json()["error"], "business_required")
        self.assertEqual(self.submit("pains", {"tags": ["nope"]}).status_code, 400)

    def test_activity_multi_and_other(self, _):
        self.walk_owner()
        data = self.submit("activity", {"activities": ["food", "beauty", "other"], "other": "  Цветы   на заказ "}).json()
        self.assertEqual(data["answers"]["activity"]["other"], "Цветы на заказ")
        business = Business.objects.get(memberships__user=self.user)
        self.assertEqual(business.segment, "horeca")
        self.assertEqual(BusinessProfile.objects.get(business=business).activity, "Еда и кафе, Красота, Цветы на заказ")
        for bad_value in (
            {"activities": ["nope"]},
            {"activities": []},
            {"activities": ["other"], "other": ""},
            {"activities": ["other"], "other": "x" * 121},
            {"activities": "retail"},
        ):
            r = self.submit("activity", bad_value)
            self.assertEqual((r.status_code, r.json()["error"]), (400, "invalid_activities"), bad_value)

    def test_activity_nul_rejected(self, _):
        self.walk_owner()
        self.assertEqual(self.submit("activity", {"activities": ["other"], "other": "a\x00b"}).status_code, 400)

    def test_member_skips_business_block(self, _):
        business = Business.objects.create(name="Shop")
        Membership.objects.create(user=self.user, business=business, role="seller")
        data = self.client.get("/api/onboarding/state/").json()
        self.assertNotIn("invite", data["steps"])
        self.assertNotIn("business", data["steps"])
        self.assertEqual(self.submit("invite", action="skip").json()["error"], "step_not_applicable")

    def test_idea_plan(self, _):
        self.submit("consent", {"ai": True})
        self.submit("name", {"first_name": "Bek"})
        self.submit("business", {"name": "Coffee", "stage": "idea"})
        data = self.submit(
            "activity", {"activities": ["retail"], "plan": {"price": 20000, "unit_cost": 8000, "units_per_month": 600, "fixed_costs_per_month": 3000000, "startup_costs": 21000000}}
        ).json()
        plan = data["answers"]["activity"]["plan"]
        self.assertEqual(plan["breakeven_units"], 250)
        self.assertEqual(plan["payback_months"], 5.0)

    def test_message_without_llm(self, _):
        self.submit("consent", {"ai": False})
        r = post(self.client, "/api/onboarding/message/", {"text": "Дильноза Каримова", "step": "name"}).json()
        self.assertEqual(r["say_key"], "onboarding.agent.saved")
        self.user.refresh_from_db()
        self.assertEqual(self.user.last_name, "Каримова")
        self.assertEqual(r["state"]["step"], "contact")


class LookupTests(Base):
    def fake_fetch(self, url, headers=None):
        return ORG_HTML if "/organization/" in url else SEARCH_HTML

    def test_inn_found_then_cached_and_confirmed(self):
        with patch.object(registry, "fetch", side_effect=self.fake_fetch) as fetch:
            r = post(self.client, "/api/onboarding/lookup/", {"query": "203366731"}).json()
            self.assertEqual(r["status"], "found")
            self.assertEqual(r["source"], "orginfo")
            self.assertFalse(r["official"])
            self.assertEqual(r["candidates"][0]["director"], "XASANOV NAZIRJON")
            post(self.client, "/api/onboarding/lookup/", {"query": "203366731"})
            self.assertEqual(fetch.call_count, 2)  # второй раз — из кэша
        self.submit("consent", {"ai": False})
        self.submit("name", {"first_name": "A"})
        state = self.submit("business", {"lookup_id": r["lookup_id"], "index": 0}).json()
        self.assertEqual(state["answers"]["business"]["source"], "orginfo")
        self.assertEqual(Membership.objects.get(user=self.user).business.name, "ООО «ТЕКСТИЛЬ ПРИНТ»")

    def test_multiple_by_name(self):
        with patch.object(registry, "fetch", return_value=MULTI_HTML):
            r = post(self.client, "/api/onboarding/lookup/", {"query": "Текстиль"}).json()
        self.assertEqual(r["status"], "multiple")
        self.assertEqual(len(r["candidates"]), 2)

    def test_unavailable_is_graceful(self):
        with patch.object(registry, "fetch", side_effect=registry.SourceError("timeout")):
            r = post(self.client, "/api/onboarding/lookup/", {"query": "203366731"}).json()
        self.assertEqual(r["status"], "unavailable")
        self.assertFalse(RegistryLookup.objects.filter(status="found").exists())

    def test_pinfl_without_official_source_unavailable_and_not_stored_raw(self):
        r = post(self.client, "/api/onboarding/lookup/", {"query": "12345678901234"}).json()
        self.assertEqual(r["status"], "unavailable")
        self.assertNotIn("12345678901234", RegistryLookup.objects.get().key)

    @override_settings(DIDOX_PARTNER_TOKEN="t", DIDOX_USER_KEY="k")
    def test_didox_first(self):
        card = {
            "tin": "", "shortName": "ERGASHEV A.", "statusName": "Действующий", "regDate": "01.03.2024",
            "selfEmployment": True, "VATRegStatus": None, "oked": "62010",
        }
        with patch("connectors.didox.request", return_value=card) as req:
            r = post(self.client, "/api/onboarding/lookup/", {"query": "52005098660032"}).json()
        self.assertEqual(req.call_args.kwargs["user_key"], "k")
        self.assertEqual((r["source"], r["official"]), ("didox", True))
        c = r["candidates"][0]
        self.assertEqual((c["name"], c["self_employed"], c["vat_payer"], c["inn"]), ("ERGASHEV A.", True, None, ""))

    def test_rate_limit(self):
        with patch.object(registry, "fetch", side_effect=registry.SourceError("x")):
            for _ in range(registry.RATE_LIMIT_PER_HOUR):
                post(self.client, "/api/onboarding/lookup/", {"query": "203366731"})
            self.assertEqual(post(self.client, "/api/onboarding/lookup/", {"query": "203366731"}).status_code, 429)


class AgentTests(Base):
    def test_heuristics(self):
        self.assertEqual(agent.heuristic("business", "203366731")[0], "lookup")
        action, value = agent.heuristic("contact", "+998 90 123 45 67, @dilnoza_k")
        self.assertEqual((value["telegram"], value["channel"]), ("dilnoza_k", "telegram"))
        self.assertEqual(agent.heuristic("tour", "в 8:30")[1], {"brief_time": "08:30"})

    def test_llm_tool_round(self):
        set_consent(self.user, "ai", True)
        replies = iter([
            {"say": "", "tool": "save_profile", "args": {"first_name": "Ali", "last_name": "Valiev"}},
            {"say": "Приятно познакомиться, Ali!", "tool": None},
        ])
        with patch.object(llm, "is_configured", return_value=True), patch.object(llm, "complete", side_effect=lambda *a, **k: next(replies)):
            r = post(self.client, "/api/onboarding/message/", {"text": "Ali Valiev", "step": "name"}).json()
        self.assertEqual(r["say"], "Приятно познакомиться, Ali!")
        self.assertEqual(OnboardingSession.objects.get(user=self.user).steps["name"], "done")

    def test_llm_failure_falls_back(self):
        set_consent(self.user, "ai", True)
        with patch.object(llm, "is_configured", return_value=True), patch.object(llm, "complete", side_effect=llm.AiUnavailable("x")):
            r = post(self.client, "/api/onboarding/message/", {"text": "Ali", "step": "name"}).json()
        self.assertEqual(r["say_key"], "onboarding.agent.saved")


class HardeningTests(Base):
    def test_lookup_forbidden_for_demo(self):
        biz = Business.objects.create(name="D", is_demo=True)
        Membership.objects.create(user=self.user, business=biz, role="owner")
        Profile.objects.filter(user=self.user).update(business=biz)
        self.assertEqual(post(self.client, "/api/onboarding/lookup/", {"query": "203366731"}).status_code, 403)

    def test_pinfl_key_is_hmac(self):
        import hashlib

        plain = hashlib.sha256(b"pinfl:12345678901234").hexdigest()
        self.assertNotEqual(registry.lookup_key("pinfl", "12345678901234"), plain)
        with override_settings(SECRET_KEY="other"):
            other = registry.lookup_key("pinfl", "12345678901234")
        self.assertNotEqual(other, registry.lookup_key("pinfl", "12345678901234"))

    @override_settings(AI_CHAT_PER_MINUTE=2)
    def test_message_throttled(self):
        statuses = [post(self.client, "/api/onboarding/message/", {"text": "hi", "step": "name"}).status_code for _ in range(3)]
        self.assertEqual(statuses[-1], 429)
        self.assertNotIn(429, statuses[:2])

    def test_rate_limit_counts_before_fetch(self):
        with patch.object(registry, "fetch", side_effect=registry.SourceError("x")) as f:
            for _ in range(registry.RATE_LIMIT_PER_HOUR):
                registry.lookup(self.user, "Текстиль Принт")
            calls = f.call_count
            with self.assertRaises(registry.RateLimited):
                registry.lookup(self.user, "Текстиль Принт")
            self.assertEqual(f.call_count, calls)
