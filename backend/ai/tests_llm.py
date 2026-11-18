from django.test import SimpleTestCase

from ai.llm import _anthropic_content


class AnthropicContentTests(SimpleTestCase):
    def test_plain_text_is_untouched(self):
        self.assertEqual(_anthropic_content("привет"), "привет")

    def test_data_url_image_becomes_base64_source(self):
        parts = [
            {"type": "text", "text": "чек"},
            {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,QUJD"}},
        ]
        self.assertEqual(_anthropic_content(parts), [
            {"type": "text", "text": "чек"},
            {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": "QUJD"}},
        ])

    def test_http_image_becomes_url_source(self):
        parts = [{"type": "image_url", "image_url": {"url": "https://example.com/a.png"}}]
        self.assertEqual(_anthropic_content(parts), [
            {"type": "image", "source": {"type": "url", "url": "https://example.com/a.png"}},
        ])


import base64
import io
import json
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings

from accounts.consent import set_consent
from accounts.models import Business, Profile

PIXEL = "data:image/png;base64," + base64.b64encode(b"\x89PNG-fake").decode()


class ChatImagesTests(TestCase):
    def setUp(self):
        cache.clear()
        user = get_user_model().objects.create(username="img")
        business = Business.objects.create(name="img")
        Profile.objects.create(user=user, business=business)
        set_consent(user, "ai", True)
        self.client.force_login(user)

    def post(self, images, text="что на фото?"):
        body = {"messages": [{"role": "user", "content": text}]}
        if images is not None:
            body["images"] = images
        return self.client.post("/api/ai/chat/", body, content_type="application/json")

    def test_invalid_images_rejected(self):
        too_big = "data:image/png;base64," + base64.b64encode(b"0" * (4 * 1024 * 1024 + 1)).decode()
        for bad in (
            "nope", [PIXEL] * 3, ["data:image/gif;base64,QUJD"], ["data:text/html;base64,QUJD"],
            ["data:image/png;base64,@@@"], ["data:image/png;base64,"], [123], too_big, [too_big],
        ):
            r = self.post(bad)
            self.assertEqual((r.status_code, r.json()), (400, {"error": "invalid_image"}), bad if len(str(bad)) < 80 else "big")

    @override_settings(LLM_API_KEY="k", LLM_BASE_URL="https://llm.test/v1", LLM_MODEL="m", LLM_FALLBACK_MODEL="", ANTHROPIC_API_KEY="")
    def test_images_reach_llm_payload(self):
        sent = []

        def fake_urlopen(request, timeout=None):
            sent.append(json.loads(request.data))
            reply = {"choices": [{"message": {"content": json.dumps({"reply": "Это чек.", "suggestions": []})}}]}
            return io.BytesIO(json.dumps(reply).encode())

        with mock.patch("ai.llm.urlopen", fake_urlopen):
            r = self.post([PIXEL, PIXEL])
        self.assertEqual(r.status_code, 200, r.content)
        last = sent[0]["messages"][-1]
        self.assertEqual(last["role"], "user")
        self.assertEqual(last["content"][0], {"type": "text", "text": "что на фото?"})
        self.assertEqual([p["image_url"]["url"] for p in last["content"][1:]], [PIXEL, PIXEL])
