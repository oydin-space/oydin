from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings

from accounts.consent import set_consent
from accounts.models import Business, Profile
from finance.models import Account

import shutil
import subprocess
import tempfile
import wave
from pathlib import Path
from unittest import skipUnless

from . import chat, draft, grounding, llm, voice


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
        set_consent(user, "ai", True)
        Account.objects.create(business=self.business, name="Наличные", kind="cash")
        self.client.force_login(user)

    def post(self, text):
        return self.client.post("/api/ai/chat/", {"messages": [{"role": "user", "content": text}]}, content_type="application/json")

    @override_settings(LLM_API_KEY="", ANTHROPIC_API_KEY="")
    def test_fallback_without_llm(self):
        r = self.post("Что с деньгами?")
        self.assertEqual(r.status_code, 200)
        self.assertTrue(r.json()["fallback"])

    @override_settings(LLM_API_KEY="", ANTHROPIC_API_KEY="")
    def test_fallback_builds_draft(self):
        r = self.post("Заплатил поставщику 4 млн наличными")
        draft_ = r.json()["draft"]
        self.assertEqual((draft_["amount"], draft_["direction"]), (4_000_000, "out"))

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


class AmountParsingTests(SimpleTestCase):
    def test_amounts(self):
        cases = {
            "потратил 2.5 млн": 2_500_000, "полтора миллиона": 1_500_000, "пол миллиона": 500_000,
            "1 млн 200 тысч": 1_200_000, "300 тыс за краску 5 штук": 300_000, "50к": 50_000,
            "yigirma ming so'm": 20_000, "Yigirma besh ming": 25_000, "3 mln so'm": 3_000_000,
            "oyligim 2 million 500 ming": 2_500_000, "Заплатил поставщику": None, "на 3 дня": None,
        }
        for text, expected in cases.items():
            self.assertEqual(draft.parse_amount(text), expected, text)

    def test_llm_json_parsing(self):
        self.assertEqual(llm.parse_reply('текст {"a": 1} хвост'), {"a": 1})
        self.assertIsNone(llm.parse_reply("не json"))
        self.assertEqual(llm.salvage_reply('{"reply": "привет", "sugg'), "привет")
        self.assertIsNone(llm.salvage_reply("нет поля"))


class DraftTests(TestCase):
    def setUp(self):
        self.business = Business.objects.create(name="d")
        self.cash = Account.objects.create(business=self.business, name="Наличные", kind="cash")
        self.card = Account.objects.create(business=self.business, name="Карта", kind="card")
        self.other = Account.objects.create(business=Business.objects.create(name="x"), name="Чужой", kind="cash")

    def test_uzbek_text_draft(self):
        d = draft.parse_text_draft(self.business, "Yetkazib beruvchiga 3 mln so'm kartadan o'tkazdim")
        self.assertEqual((d["amount"], d["direction"], d["account_id"], d["category"]), (3_000_000, "out", self.card.id, "Поставщик"))
        d = draft.parse_text_draft(self.business, "Mijoz 5 mln so'm naqd to'ladi")
        self.assertEqual((d["amount"], d["direction"], d["account_id"]), (5_000_000, "in", self.cash.id))

    def test_no_amount_no_draft(self):
        self.assertIsNone(draft.parse_text_draft(self.business, "Заплатил поставщику"))

    def test_validate_rejects_foreign_account_and_bad_amount(self):
        raw = {"amount": 1000, "direction": "out", "category": "Прочее", "account_id": self.cash.id}
        self.assertEqual(draft.validate_draft(self.business, raw)["amount"], 1000)
        self.assertIsNone(draft.validate_draft(self.business, {**raw, "account_id": self.other.id}))
        self.assertIsNone(draft.validate_draft(self.business, {**raw, "amount": "1000"}))
        self.assertIsNone(draft.validate_draft(self.business, {**raw, "amount": -5}))

    def test_finish_repairs_broken_model_draft_from_phrase(self):
        out = {"reply": "Записал расход 300 тыс.", "draft": {"amount": 300000, "direction": "out"}}
        result = chat._finish(self.business, out, grounding.Evidence(), "Заплатил 300 тыс за краску")
        self.assertEqual(result["draft"]["amount"], 300_000)

    def test_finish_rejects_invented_numbers(self):
        out = {"reply": "У вас на счету 99 млн"}
        self.assertIsNone(chat._finish(self.business, out, grounding.Evidence({"b": 1_000_000}), "сколько?"))


@skipUnless(shutil.which("ffmpeg"), "ffmpeg не установлен")
class VoiceConversionTests(SimpleTestCase):
    def sample(self, ext, codec):
        with tempfile.TemporaryDirectory() as tmp:
            out = Path(tmp) / f"a.{ext}"
            subprocess.run(["ffmpeg", "-v", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=1", "-c:a", codec, str(out)], check=True)
            return out.read_bytes()

    def test_formats_become_16k_mono_wav(self):
        for ext, codec, mime in [("webm", "libopus", "audio/webm;codecs=opus"), ("ogg", "libopus", "audio/ogg"), ("mp4", "aac", "audio/mp4")]:
            wav = voice.to_wav(self.sample(ext, codec), mime)
            with tempfile.NamedTemporaryFile(suffix=".wav") as f:
                f.write(wav)
                f.flush()
                with wave.open(f.name) as w:
                    self.assertEqual((w.getframerate(), w.getnchannels()), (16000, 1), ext)

    def test_garbage_and_unknown_type_rejected(self):
        with self.assertRaises(ValueError):
            voice.to_wav(b"not audio at all" * 100, "audio/webm")
        with self.assertRaises(ValueError):
            voice.to_wav(b"x", "text/plain")


from unittest.mock import patch  # noqa: E402

from . import ui  # noqa: E402

GOOD_UI = '''root = Stack([s, calc])
s = StatCard("На счетах", 2480000, "по данным", "mint")
calc = Calculator("Что если", [a, b], [o])
a = MoneyField("extra", "Доп. расход", 0)
b = SliderField("days", "Задержка, дней", 10, 0, 60, 5)
o = Output("Останется", "max(0, 2480000 - extra) / max(days, 1)", "money")'''


class UiValidationTests(SimpleTestCase):
    def test_allowed_components(self):
        self.assertEqual(ui.validate(GOOD_UI), GOOD_UI)
        self.assertIsNotNone(ui.validate_tool(GOOD_UI))

    def test_unknown_component_and_syntax(self):
        self.assertIsNone(ui.validate('root = Stack([x])\nx = Script("alert(1)")'))
        self.assertIsNone(ui.validate('root = Stack([x])\nx = TextBlock($name)'))
        self.assertIsNone(ui.validate('root = Stack([x])\nx = Query("a")'))
        self.assertIsNone(ui.validate('x = TextBlock("без root")'))
        self.assertIsNone(ui.validate('root = Stack([missing])'))
        self.assertIsNone(ui.validate('root = Stack([root])'))

    def test_formula_safety(self):
        bad = GOOD_UI.replace("max(days, 1)", "__import__(days)")
        self.assertIsNone(ui.validate(bad))
        self.assertIsNone(ui.validate(GOOD_UI.replace("extra) /", "unknown) /")))
        with self.assertRaises(ui.Invalid):
            ui.check_formula("a ** 2", {"a"})
        ui.check_formula("round(min(a, 2) * (b + 1) / 3, 2)", {"a", "b"})

    def test_size_limit(self):
        big = 'root = Stack([t])\nt = TextBlock("' + "x" * 1500 + '")\n' + "\n".join(f'p{i} = TextBlock("{"y" * 100}")' for i in range(700))
        self.assertGreater(len(big.encode()), ui.MAX_SIZE)
        self.assertIsNone(ui.validate(big))

    def test_grounding_in_chat(self):
        evidence = grounding.Evidence({"balance": 2_480_000})
        self.assertIsNotNone(ui.validate(GOOD_UI, evidence))
        self.assertIsNone(ui.validate(GOOD_UI.replace("2480000, \"по", "9100000, \"по"), evidence))

    def test_tool_needs_calculator(self):
        self.assertIsNone(ui.validate_tool('root = Stack([t])\nt = TextBlock("привет")'))

    def test_library_prompt_lists_components(self):
        for name in ui.COMPONENTS:
            self.assertIn(name + "(", ui.LIBRARY_PROMPT)


class ChatUiTests(ChatTests):
    def reply(self, ui_text):
        return {"reply": "На счетах пока пусто.", "suggestions": [], "chart": None, "draft": None, "ui": ui_text}

    @override_settings(LLM_API_KEY="k", LLM_BASE_URL="http://x", LLM_MODEL="m")
    def test_chat_returns_valid_ui(self):
        text = 'root = Stack([t])\nt = TextBlock("Сводка", "title")'
        with patch("ai.chat.llm.complete", return_value=self.reply(text)):
            body = self.post("Покажи сводку").json()
        self.assertFalse(body["fallback"])
        self.assertEqual(body["ui"], text)

    @override_settings(LLM_API_KEY="k", LLM_BASE_URL="http://x", LLM_MODEL="m")
    def test_chat_omits_invalid_ui(self):
        for bad in ['root = Stack([t])\nt = Iframe("x")', 'root = Stack([s])\ns = StatCard("Выдумка", 77000000)']:
            with patch("ai.chat.llm.complete", return_value=self.reply(bad)):
                body = self.post("Покажи сводку").json()
            self.assertFalse(body["fallback"])
            self.assertNotIn("ui", body)


class ToolGenerateTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user = get_user_model().objects.create(username="g")
        self.business = Business.objects.create(name="g")
        Profile.objects.create(user=self.user, business=self.business)
        Account.objects.create(business=self.business, name="Наличные", kind="cash")
        self.client.force_login(self.user)

    def gen(self, **body):
        return self.client.post("/api/ai/tools/generate/", body, content_type="application/json")

    @override_settings(LLM_API_KEY="", ANTHROPIC_API_KEY="")
    def test_builtin_kinds_without_llm_or_consent(self):
        for kind in ["what_if_gap", "unit_cost", "break_even", "payroll", "loan", "envelope_plan_fact", "receivables_aging"]:
            r = self.gen(prompt="", kind=kind)
            self.assertEqual(r.status_code, 200, kind)
            body = r.json()
            self.assertEqual(body["kind"], kind)
            self.assertTrue(body["title"])
            self.assertIsNotNone(ui.validate_tool(body["spec"]), kind)

    @override_settings(LLM_API_KEY="", ANTHROPIC_API_KEY="")
    def test_kind_inferred_from_prompt(self):
        self.assertEqual(self.gen(prompt="посчитай кредит на 12 месяцев").json()["kind"], "loan")

    def test_tax_refused(self):
        self.assertEqual(self.gen(prompt="x", kind="tax").json(), {"error": "unsupported_kind"})
        r = self.gen(prompt="калькулятор НДС")
        self.assertEqual((r.status_code, r.json()["error"]), (400, "unsupported_kind"))

    @override_settings(LLM_API_KEY="", ANTHROPIC_API_KEY="")
    def test_custom_needs_consent(self):
        self.assertEqual(self.gen(prompt="маржа по кофе", kind="custom").json()["error"], "ai_consent_required")

    @override_settings(LLM_API_KEY="k", LLM_BASE_URL="http://x", LLM_MODEL="m")
    def test_custom_with_llm(self):
        set_consent(self.user, "ai", True)
        spec = 'root = Stack([c])\nc = Calculator("Кофе", [p], [o])\np = MoneyField("price", "Цена", 20000)\no = Output("x2", "price * 2", "money")'
        with patch("ai.views.llm.complete", return_value={"title": "Кофе", "ui": spec}):
            body = self.gen(prompt="маржа по кофе", kind="custom").json()
        self.assertEqual((body["kind"], body["spec"]), ("custom", spec))
        with patch("ai.views.llm.complete", return_value={"title": "Кофе", "ui": "root = Stack([x])\nx = Bad()"}):
            self.assertEqual(self.gen(prompt="маржа по кофе", kind="custom").status_code, 400)


from . import categories, tools  # noqa: E402


class ChatFixTests(ChatTests):
    def chat(self, text, lang=None, reply=None):
        body = {"messages": [{"role": "user", "content": text}]}
        if lang:
            body["lang"] = lang
        if reply is None:
            return self.client.post("/api/ai/chat/", body, content_type="application/json").json()
        with override_settings(LLM_API_KEY="k", LLM_BASE_URL="http://x", LLM_MODEL="m"), patch("ai.chat.llm.complete", return_value=reply):
            return self.client.post("/api/ai/chat/", body, content_type="application/json").json()

    @override_settings(LLM_API_KEY="", ANTHROPIC_API_KEY="")
    def test_confirmed_draft_becomes_transaction(self):
        from finance.models import Transaction
        body = self.chat("потратил 50000 на такси")
        d = body["draft"]
        self.assertIn("черновик", body["reply"])
        self.assertNotIn("Записал", body["reply"])
        self.assertFalse(Transaction.objects.filter(business=self.business).exists())
        r = self.client.post("/api/transactions/", d, content_type="application/json")
        self.assertEqual(r.status_code, 201, r.content)
        self.assertTrue(Transaction.objects.filter(business=self.business, amount=50000, category="Транспорт",
                                                   direction="out", status="confirmed").exists())

    @override_settings(LLM_API_KEY="", ANTHROPIC_API_KEY="")
    def test_fallback_follows_ui_language(self):
        body = self.chat("потратил 50000 на такси", lang="en")
        self.assertIn("Draft", body["reply"])
        self.assertIn("Transport", body["reply"])
        self.assertNotRegex(body["reply"], "[а-яА-Я]")
        self.assertEqual(body["draft"]["category"], "Транспорт")  # в базе — каноническое имя

    def test_model_claiming_saved_gets_draft_and_notice(self):
        body = self.chat("потратил 50000 на такси", reply={"reply": "Записал расход на такси.", "suggestions": [
            "Посчитать оборотный налог", "Что с деньгами на неделе?"], "draft": None})
        self.assertEqual(body["draft"]["amount"], 50000)
        self.assertIn("черновик", body["reply"])
        self.assertEqual(body["suggestions"], ["Что с деньгами на неделе?"])

    def test_english_model_category_is_canonicalized(self):
        cash = Account.objects.get(business=self.business)
        body = self.chat("spent 50000 on taxi", lang="en", reply={"reply": "Draft ready.", "draft": {
            "amount": 50000, "direction": "out", "category": "Transport", "purpose": "business", "account_id": cash.id}})
        self.assertEqual(body["draft"]["category"], "Транспорт")

    def test_compare_months_and_localization(self):
        months = tools.run_tool(self.business, "compare_months", {"months": 2}, "en")["months"]
        self.assertEqual(len(months), 2)
        self.assertIn("same_days_as_current", months[1])
        self.assertEqual(categories.canonical("Transport"), "Транспорт")
        self.assertEqual(categories.localize("Аренда", "uz"), "Ijara")
        facts = tools.build_facts(self.business, lang="en")
        self.assertIn("this_and_last_month", facts)


class GroundingLocaleTests(SimpleTestCase):
    def test_english_and_uzbek_multipliers(self):
        ev = grounding.Evidence({"a": 12_200_000, "b": 130_000}, [])
        self.assertEqual(grounding.ungrounded_numbers("Revenue 12.2M UZS, rent 130K UZS", ev), [])
        self.assertEqual(grounding.ungrounded_numbers("Tushum 12,2 mln soʻm, 130 ming", ev), [])
        self.assertTrue(grounding.ungrounded_numbers("Revenue 99M UZS", ev))
