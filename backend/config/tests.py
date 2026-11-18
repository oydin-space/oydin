from django.test import SimpleTestCase

from . import settings as cfg


class SentryScrubTests(SimpleTestCase):
    def test_query_string_and_cookies_masked(self):
        ev = {"request": {"query_string": "a=1&token=abc&code=&x=%D1%8F", "cookies": "sid=1; secret=zzz; k=v"}}
        out = cfg.sentry_before_send(ev, {})["request"]
        self.assertNotIn("abc", out["query_string"])
        self.assertIn("a=1", out["query_string"])
        self.assertIn("code=%5BFiltered%5D", out["query_string"])
        self.assertNotIn("zzz", out["cookies"])
        self.assertIn("sid=1", out["cookies"])

    def test_tax_ids_masked_in_breadcrumbs_and_transactions(self):
        crumb = cfg.sentry_before_breadcrumb({"data": {"url": "https://api.didox.uz/v1/profile/123456789/docs?x=1"}, "message": "GET /v1/profile/305123456 ok"}, {})
        self.assertEqual(crumb["data"]["url"], "https://api.didox.uz/v1/profile/[id]/docs?x=1")
        self.assertNotIn("305123456", crumb["message"])
        ev = {"transaction": "/api/didox/305123456/", "request": {"url": "https://h/api/didox/305123456"},
              "spans": [{"description": "GET https://api.didox.uz/v1/profile/305123456", "data": {"url": "https://x/12345678901"}}]}
        out = cfg.sentry_before_send_transaction(ev, {})
        self.assertEqual(out["transaction"], "/api/didox/[id]/")
        self.assertNotIn("305123456", str(out))
        self.assertNotIn("12345678901", str(out))

    def test_bot_token_and_query_secrets_masked(self):
        tok = "bot123456:AAH-x_yZ"
        crumb = cfg.sentry_before_breadcrumb(
            {"data": {"url": f"https://api.telegram.org/{tok}/sendMessage", "http.query": "a=1&access_token=AT1&code=C1",
                      "http.fragment": "id_token=IT1"}, "message": f"POST /{tok}/getMe"}, {})
        s = str(crumb)
        for secret in ("AAH-x_yZ", "AT1", "C1", "IT1"):
            self.assertNotIn(secret, s)
        self.assertIn("a=1", crumb["data"]["http.query"])
        ev = {"spans": [{"description": f"POST https://api.telegram.org/{tok}/x?refresh_token=RT1",
                         "data": {"url": f"https://api.telegram.org/{tok}/x", "http.query": "client_secret=CS1"}}],
              "exception": {"values": [{"value": f"HTTPError for url https://api.telegram.org/{tok}/x"}]},
              "breadcrumbs": {"values": [{"data": {"url": f"https://t/{tok}/y#access_token=AT2"}}]},
              "request": {"data": {"phone": "+998901234567", "email": "a@b.uz", "tax_id": "305123456", "pinfl": "1" * 14}}}
        out = str(cfg.sentry_before_send_transaction(ev, {}))
        for secret in ("AAH-x_yZ", "RT1", "CS1", "AT2", "+998901234567", "a@b.uz", "305123456", "1" * 14):
            self.assertNotIn(secret, out)


class ThrottleWindowTests(SimpleTestCase):
    def test_fixed_window_not_extended_by_blocked_requests(self):
        from unittest import mock

        from django.core.cache import cache

        from accounts.http import ApiError
        from ai.views import throttle

        cache.clear()
        user = mock.Mock(id=987)
        with mock.patch("ai.views.time.time", return_value=120.0):
            throttle(user, "t", 1)
            for _ in range(3):
                with self.assertRaises(ApiError):
                    throttle(user, "t", 1)
        with mock.patch("ai.views.time.time", return_value=180.0):
            throttle(user, "t", 1)  # новое окно — лимит сброшен, несмотря на запросы во время блокировки
