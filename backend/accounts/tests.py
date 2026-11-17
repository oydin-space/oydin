import hashlib
import hmac
import json
import time
from urllib.parse import urlencode

from django.test import SimpleTestCase, TestCase, override_settings

from .telegram import InvalidInitData, validate_init_data

TOKEN = "123:test-token"


def sign(fields, token=TOKEN):
    check = "\n".join(f"{k}={fields[k]}" for k in sorted(fields))
    secret = hmac.new(b"WebAppData", token.encode(), hashlib.sha256).digest()
    return urlencode({**fields, "hash": hmac.new(secret, check.encode(), hashlib.sha256).hexdigest()})


class TelegramInitDataTests(SimpleTestCase):
    def fields(self, age=0):
        return {"auth_date": str(int(time.time()) - age), "user": json.dumps({"id": 42, "first_name": "Али"})}

    def test_valid(self):
        self.assertEqual(validate_init_data(sign(self.fields()), TOKEN)["id"], 42)

    def test_bad_hash(self):
        with self.assertRaises(InvalidInitData):
            validate_init_data(sign(self.fields(), "other:token"), TOKEN)

    def test_stale(self):
        with self.assertRaises(InvalidInitData):
            validate_init_data(sign(self.fields(age=2 * 86400)), TOKEN)

    def test_no_token(self):
        with self.assertRaises(InvalidInitData):
            validate_init_data(sign(self.fields()), "")


@override_settings(TELEGRAM_BOT_TOKEN=TOKEN)
class TelegramLoginTests(TestCase):
    def test_login_creates_business_and_session(self):
        init = sign({"auth_date": str(int(time.time())), "user": json.dumps({"id": 7, "first_name": "Али"})})
        r = self.client.post("/api/auth/telegram/", {"init_data": init}, content_type="application/json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get("/api/me/").status_code, 200)
        self.assertEqual(len(self.client.get("/api/accounts/").json()["items"]), 3)

    def test_forged_rejected(self):
        r = self.client.post("/api/auth/telegram/", {"init_data": "hash=bad&auth_date=1"}, content_type="application/json")
        self.assertEqual(r.status_code, 401)
