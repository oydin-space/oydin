import hashlib
import hmac
import json
import time

from django.test import TestCase, override_settings

from accounts.models import Profile

TOKEN = "123:widget-token"
URL = "/api/auth/telegram/widget/"


def widget_payload(token=TOKEN, **over):
    data = {"id": 555, "first_name": "Али", "username": "ali", "auth_date": int(time.time())}
    data.update(over)
    check = "\n".join(f"{k}={data[k]}" for k in sorted(data))
    secret = hashlib.sha256(token.encode()).digest()
    data["hash"] = hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()
    return data


@override_settings(TELEGRAM_BOT_TOKEN=TOKEN)
class TelegramWidgetTests(TestCase):
    def post(self, payload):
        return self.client.post(URL, payload, content_type="application/json")

    def test_valid_logs_in_and_creates_user(self):
        r = self.post(widget_payload())
        self.assertEqual(r.status_code, 200)
        self.assertTrue(Profile.objects.filter(telegram_id=555).exists())
        self.assertEqual(self.client.get("/api/me/").status_code, 200)

    def test_same_user_as_mini_app(self):
        from accounts import tests as t

        init = t.sign({"auth_date": str(int(time.time())), "user": json.dumps({"id": 555, "first_name": "Али"})})
        self.client.post("/api/auth/telegram/", {"init_data": init}, content_type="application/json")
        self.client.post("/api/auth/logout/", content_type="application/json")
        self.assertEqual(self.post(widget_payload()).status_code, 200)
        self.assertEqual(Profile.objects.filter(telegram_id=555).count(), 1)

    def test_bad_hash(self):
        p = widget_payload()
        p["first_name"] = "Хакер"
        r = self.post(p)
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.json(), {"error": "invalid_hash"})

    def test_stale_auth_date(self):
        r = self.post(widget_payload(auth_date=int(time.time()) - 25 * 3600))
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json(), {"error": "expired"})

    @override_settings(TELEGRAM_BOT_TOKEN="")
    def test_no_token(self):
        r = self.post(widget_payload())
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json(), {"error": "telegram_not_configured"})
