from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings

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
