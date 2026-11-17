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
