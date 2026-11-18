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
