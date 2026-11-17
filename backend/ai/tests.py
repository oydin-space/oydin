from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings

from accounts.models import Business, Profile
from finance.models import Account

from . import draft, grounding


class GroundingTests(SimpleTestCase):
    def test_numbers_and_support(self):
        evidence = grounding.Evidence({"balance": 2_480_000})
        self.assertEqual(grounding.ungrounded_numbers("Свободно 2,5 млн", evidence), [])
        self.assertEqual(len(grounding.ungrounded_numbers("Свободно 9 млн", evidence)), 1)

    def test_chart_rejects_invented_values(self):
        evidence = grounding.Evidence({"a": 1_000_000})
        good = {"type": "bar", "title": "t", "unit": "сум", "data": [{"label": "a", "value": 1_000_000}]}
        self.assertIsNotNone(grounding.valid_chart(good, evidence))
        bad = {**good, "data": [{"label": "a", "value": 7_000_000}]}
        self.assertIsNone(grounding.valid_chart(bad, evidence))


class ChatTests(TestCase):
    def setUp(self):
        cache.clear()
        user = get_user_model().objects.create(username="c")
        self.business = Business.objects.create(name="c")
        Profile.objects.create(user=user, business=self.business)
        Account.objects.create(business=self.business, name="Наличные", kind="cash")
        self.client.force_login(user)

    def post(self, text):
        return self.client.post("/api/ai/chat/", {"messages": [{"role": "user", "content": text}]}, content_type="application/json")

    @override_settings(LLM_API_KEY="")
    def test_fallback_without_llm(self):
        r = self.post("Что с деньгами?")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["fallback"])

    @override_settings(LLM_API_KEY="")
    def test_fallback_builds_draft(self):
        r = self.post("Заплатил поставщику 4 млн наличными")
        draft_ = r.json()["draft"]
        self.assertEqual((draft_["amount"], draft_["direction"], draft_["category"]), (4_000_000, "out", "Поставщик"))

    def test_validation(self):
        r = self.client.post("/api/ai/chat/", {"messages": [{"role": "assistant", "content": "x"}]}, content_type="application/json")
        self.assertEqual(r.status_code, 400)

    @override_settings(LLM_API_KEY="", AI_CHAT_PER_MINUTE=1)
    def test_rate_limit(self):
        self.post("привет")
        self.assertEqual(self.post("привет").status_code, 429)

    def test_text_draft_parser(self):
        self.assertEqual(draft.parse_amount("150 тысяч"), 150_000)
        self.assertEqual(draft.parse_amount("1 200 000"), 1_200_000)
