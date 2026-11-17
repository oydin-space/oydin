import json
import time

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import TestCase, override_settings

from . import tests as t
from .tests_tg_widget import TOKEN as WTOKEN, widget_payload

User = get_user_model()


@override_settings(DEMO_LOGIN=True)
class DemoLoginTests(TestCase):
    def test_requires_json_content_type(self):
        r = self.client.post("/api/auth/demo/")
        self.assertEqual((r.status_code, r.json()), (415, {"error": "unsupported_media_type"}))

    def test_json_ok(self):
        self.assertEqual(self.client.post("/api/auth/demo/", {}, content_type="application/json").status_code, 200)

    def test_non_demo_user_conflict(self):
        self.client.force_login(User.objects.create_user("real"))
        r = self.client.post("/api/auth/demo/", {}, content_type="application/json")
        self.assertEqual((r.status_code, r.json()), (409, {"error": "already_authenticated"}))


@override_settings(TELEGRAM_BOT_TOKEN=t.TOKEN)
class MiniAppLoginTests(TestCase):
    def login(self, uid):
        init = t.sign({"auth_date": str(int(time.time())), "user": json.dumps({"id": uid, "first_name": "A"})})
        return self.client.post("/api/auth/telegram/", {"init_data": init}, content_type="application/json")

    def test_staff_blocked(self):
        self.assertEqual(self.login(901).status_code, 200)
        User.objects.filter(username="tg_901").update(is_staff=True)
        self.client.post("/api/auth/logout/", content_type="application/json")
        r = self.login(901)
        self.assertEqual((r.status_code, r.json()), (403, {"error": "forbidden"}))

    def test_claims_invites(self):
        from unittest import mock

        with mock.patch("accounts.views.claim_invites") as claim:
            self.assertEqual(self.login(902).status_code, 200)
        claim.assert_called_once()

    def test_future_auth_date_rejected(self):
        init = t.sign({"auth_date": str(int(time.time()) + 3600), "user": json.dumps({"id": 903})})
        r = self.client.post("/api/auth/telegram/", {"init_data": init}, content_type="application/json")
        self.assertEqual(r.status_code, 401)


@override_settings(TELEGRAM_BOT_TOKEN=WTOKEN)
class WidgetHardeningTests(TestCase):
    def setUp(self):
        cache.clear()

    def post(self, p):
        return self.client.post("/api/auth/telegram/widget/", p, content_type="application/json")

    def test_replay_rejected(self):
        p = widget_payload(id=801)
        self.assertEqual(self.post(p).status_code, 200)
        r = self.post(p)
        self.assertEqual((r.status_code, r.json()), (403, {"error": "invalid_hash"}))

    def test_older_than_10_minutes(self):
        r = self.post(widget_payload(id=802, auth_date=int(time.time()) - 11 * 60))
        self.assertEqual((r.status_code, r.json()), (400, {"error": "expired"}))

    def test_future_rejected(self):
        r = self.post(widget_payload(id=803, auth_date=int(time.time()) + 120))
        self.assertEqual((r.status_code, r.json()), (400, {"error": "expired"}))
