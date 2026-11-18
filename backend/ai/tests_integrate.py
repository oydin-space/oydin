from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings

from accounts.consent import set_consent
from accounts.models import Business, Membership, Profile
from finance.models import Account

from . import chat, ui

GOOD = 'root = Stack([c])\nc = Calculator("Кофе", [p], [o])\np = MoneyField("price", "Цена", 20000)\no = Output("x2", "price * 2", "money")'
BAD = "root = Stack([x])\nx = Bad()"
LLM = dict(LLM_API_KEY="k", LLM_BASE_URL="http://x", LLM_MODEL="m")


class CheckTests(SimpleTestCase):
    def test_rejections_have_detail(self):
        for bad in [BAD, "", 'root = Stack([t])\nt = TextBlock("x")', 'root = Stack([c])\nc = Calculator("a", [p], [o])\np = MoneyField("p", "P", 1)\no = Output("o", "import os", "money")']:
            clean, detail = ui.check(bad, tool=True)
            self.assertIsNone(clean)
            self.assertTrue(detail)

    def test_valid(self):
        self.assertEqual(ui.check(GOOD, tool=True), (GOOD, None))


class Base(TestCase):
    role = Membership.Role.OWNER

    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create(username="i")
        self.business = Business.objects.create(name="i")
        Profile.objects.create(user=self.user, business=self.business)
        Membership.objects.update_or_create(user=self.user, business=self.business, defaults={"role": self.role})
        set_consent(self.user, "ai", True)
        Account.objects.create(business=self.business, name="Наличные", kind="cash")
        self.client.force_login(self.user)


@override_settings(**LLM)
class GenerateTests(Base):
    def gen(self):
        return self.client.post("/api/ai/tools/generate/", {"prompt": "маржа", "kind": "custom"}, content_type="application/json")

    def test_retry_feeds_error_then_succeeds(self):
        outs = [{"title": "К", "ui": BAD}, {"title": "К", "ui": GOOD}]
        with patch("ai.views.llm.complete", side_effect=outs) as m:
            r = self.gen()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["spec"], GOOD)
        self.assertIn("невалиден", m.call_args.args[1][-1]["content"])
        self.assertEqual(m.call_count, 2)

    def test_two_invalid_gives_400(self):
        with patch("ai.views.llm.complete", return_value={"title": "К", "ui": BAD}) as m:
            r = self.gen()
        self.assertEqual((r.status_code, r.json()["error"]), (400, "invalid_ui"))
        self.assertTrue(r.json()["detail"])
        self.assertEqual(m.call_count, 2)


@override_settings(**LLM)
class ChatIntegrateTests(Base):
    def post(self, text="привет"):
        return self.client.post("/api/ai/chat/", {"messages": [{"role": "user", "content": text}]}, content_type="application/json")

    @staticmethod
    def reply(ui_text):
        return {"reply": "На счетах пока пусто.", "suggestions": [], "chart": None, "draft": None, "ui": ui_text}

    def test_invalid_ui_retried_once_with_error(self):
        good = 'root = Stack([t])\nt = TextBlock("Сводка", "title")'
        with patch("ai.chat.llm.complete", side_effect=[self.reply("root = Stack([t])\nt = Iframe(1)"), self.reply(good)]) as m:
            body = self.post().json()
        self.assertEqual(body["ui"], good)
        self.assertEqual(m.call_count, 2)
        self.assertIn("ui невалидно", m.call_args.args[1][-1]["content"])

    def test_still_invalid_after_retry_is_dropped(self):
        with patch("ai.chat.llm.complete", return_value=self.reply(BAD)) as m:
            body = self.post().json()
        self.assertNotIn("ui", body)
        self.assertEqual(m.call_count, 2)

    def spec(self, calls):
        return {"name": "c1_rate", "description": "Курс", "parameters": {"type": "object", "properties": {}}, "connector_id": 1,
                "call": lambda args: calls.append(args) or {"rate": 12000}}

    def test_connector_tool_dispatch(self):
        calls = []
        outs = [{"tool": "ext_c1_rate", "args": {"x": 1}}, self.reply(None)]
        with patch("ai.chat.connectors.connector_tools", return_value=[self.spec(calls)]), patch("ai.chat.llm.complete", side_effect=outs) as m:
            body = self.post().json()
        self.assertEqual(calls, [{"x": 1}])
        self.assertFalse(body["fallback"])
        self.assertIn("ext_c1_rate", m.call_args_list[0].args[0])
        self.assertIn("12000", m.call_args.args[1][-1]["content"])

    def test_connector_error_is_tool_result(self):
        def boom(args):
            raise RuntimeError("down")
        spec = {**self.spec([]), "call": boom}
        with patch("ai.chat.connectors.connector_tools", return_value=[spec]), patch("ai.chat.llm.complete", side_effect=[{"tool": "ext_c1_rate"}, self.reply(None)]) as m:
            body = self.post().json()
        self.assertFalse(body["fallback"])
        self.assertIn("down", m.call_args.args[1][-1]["content"])


class SellerHasNoConnectors(SimpleTestCase):
    def test_seller_and_unknown_get_none(self):
        with patch("ai.chat.connectors.connector_tools", side_effect=AssertionError):
            self.assertEqual(chat.external_tools(None, Membership.Role.SELLER), {})
            self.assertEqual(chat.external_tools(None, None), {})
