import re
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.test import TestCase, override_settings
from django.utils import timezone

from accounts import otp
from accounts.models import Business, EmailCode, Membership, Profile
from accounts.tests import jpatch, jpost, make_member

User = get_user_model()
EMAIL = "ali@example.com"


def code_row(email, code, **extra):
    return EmailCode.objects.create(
        email=email, code_hash=otp._hash(email, code), expires_at=timezone.now() + timedelta(minutes=5), **extra
    )


def verify(client, code, email=EMAIL):
    return jpost(client, "/api/auth/email/verify/", {"email": email, "code": code})


class OtpSecurityTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_attempts_consumed_atomically_then_429(self):
        row = code_row(EMAIL, "123456")
        for _ in range(otp.MAX_ATTEMPTS):
            self.assertEqual(verify(self.client, "000000").status_code, 400)
        row.refresh_from_db()
        self.assertEqual(row.attempts, otp.MAX_ATTEMPTS)
        # Даже верный код после исчерпания попыток не принимается.
        self.assertEqual(verify(self.client, "123456").status_code, 429)

    def test_used_code_cannot_be_replayed(self):
        code_row(EMAIL, "123456")
        self.assertEqual(verify(self.client, "123456").status_code, 200)
        self.client.logout()
        self.assertEqual(verify(self.client, "123456").status_code, 400)

    def test_mark_used_requires_one_row(self):
        row = code_row(EMAIL, "123456")
        real_filter = EmailCode.objects.filter

        def racing(*args, **kwargs):
            qs = real_filter(*args, **kwargs)
            if kwargs.get("used") is False and "attempts__lt" not in kwargs:
                real_filter(pk=row.pk).update(used=True)  # конкурент успел раньше
            return qs

        with mock.patch.object(EmailCode.objects, "filter", side_effect=racing):
            with self.assertRaises(otp.ApiError) as ctx:
                otp.verify_code(EMAIL, "123456")
        self.assertEqual(ctx.exception.status, 400)

    def test_verify_per_ip_throttle(self):
        with mock.patch.object(otp, "VERIFY_PER_IP_HOURLY", 2):
            codes = [verify(self.client, "000000").status_code for _ in range(3)]
        self.assertEqual(codes, [400, 400, 429])

    @override_settings(EMAIL_CONFIGURED=True, DEFAULT_FROM_EMAIL="n@oydin.test")
    def test_new_request_keeps_earlier_code_valid(self):
        self.assertEqual(jpost(self.client, "/api/auth/email/request/", {"email": EMAIL}).status_code, 200)
        first = re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)
        EmailCode.objects.update(created_at=timezone.now() - timedelta(minutes=2))
        self.assertEqual(jpost(self.client, "/api/auth/email/request/", {"email": EMAIL}).status_code, 200)
        self.assertEqual(EmailCode.objects.filter(used=False).count(), 2)
        self.assertEqual(verify(self.client, first).status_code, 200)


class StaffLoginTests(TestCase):
    def setUp(self):
        cache.clear()

    def test_email_verify_refuses_staff(self):
        User.objects.create_superuser("root", EMAIL, "pw-Str0ng-pass")
        code_row(EMAIL, "123456")
        r = verify(self.client, "123456")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.json(), {"error": "forbidden"})
        self.assertEqual(self.client.get("/api/me/").status_code, 401)

    @override_settings(GOOGLE_CLIENT_ID="x", GOOGLE_CLIENT_SECRET="y")
    def test_google_callback_refuses_staff(self):
        staff = User.objects.create_user("st", EMAIL, "pw-Str0ng-pass", is_staff=True)
        s = self.client.session
        s["google_oauth"] = {"state": "s", "verifier": "v", "nonce": "n"}
        s.save()
        with mock.patch("accounts.google.is_configured", return_value=True), \
                mock.patch("accounts.google.exchange_code", return_value="t"), \
                mock.patch("accounts.google.verify_id_token", return_value={"email": EMAIL, "sub": "1"}), \
                mock.patch("accounts.views.user_for_google", return_value=staff):
            r = self.client.get("/api/auth/google/callback/", {"state": "s", "code": "c"})
        self.assertEqual(r.status_code, 302)
        self.assertIn("auth_error=forbidden", r["Location"])
        self.assertEqual(self.client.get("/api/me/").status_code, 401)

    def test_ensure_admin_does_not_promote_existing_user(self):
        user = User.objects.create(username="u", email="boss@oydin.uz")
        with override_settings(ADMIN_EMAIL="boss@oydin.uz", ADMIN_PASSWORD="s3cret-pass"):
            call_command("ensure_admin")
        user.refresh_from_db()
        self.assertFalse(user.is_staff or user.is_superuser)
        self.assertFalse(user.check_password("s3cret-pass"))


class HardeningSettingsTests(TestCase):
    def test_password_validators_enabled(self):
        from django.conf import settings
        from django.contrib.auth.password_validation import validate_password
        from django.core.exceptions import ValidationError

        self.assertTrue(settings.AUTH_PASSWORD_VALIDATORS)
        with self.assertRaises(ValidationError):
            validate_password("12345678")

    def test_x_frame_options_deny(self):
        r = self.client.get("/api/csrf/")
        self.assertEqual(r.headers.get("X-Frame-Options"), "DENY")


class DemoTenantTests(TestCase):
    def setUp(self):
        self.user, self.biz = make_member("o")
        self.biz.is_demo = True
        self.biz.save()
        self.other, _ = make_member("x", business=self.biz, role="accountant")
        self.client.force_login(self.user)
        self.base = f"/api/businesses/{self.biz.id}/"

    def test_demo_is_read_only(self):
        m = Membership.objects.get(user=self.other, business=self.biz)
        self.assertEqual(jpost(self.client, self.base + "members/", {"email": "n@e.com", "role": "seller"}).status_code, 403)
        self.assertEqual(jpatch(self.client, f"{self.base}members/{m.id}/", {"role": "seller"}).status_code, 403)
        self.assertEqual(self.client.delete(f"{self.base}members/{m.id}/").status_code, 403)
        self.assertEqual(jpatch(self.client, self.base, {"name": "hack"}).status_code, 403)
        self.biz.refresh_from_db()
        self.assertNotEqual(self.biz.name, "hack")
        self.assertTrue(Membership.objects.filter(pk=m.pk).exists())


class InviteTests(TestCase):
    def setUp(self):
        self.owner, self.biz = make_member("o")
        self.client.force_login(self.owner)
        self.url = f"/api/businesses/{self.biz.id}/members/"

    def test_invite_is_always_pending_and_leaks_nothing(self):
        existing, _ = make_member("e", email="exists@e.com")
        a = jpost(self.client, self.url, {"email": "exists@e.com", "role": "seller"})
        b = jpost(self.client, self.url, {"email": "ghost@e.com", "role": "seller"})
        for r in (a, b):
            self.assertEqual(r.status_code, 201)
            self.assertTrue(r.json()["pending"])
            self.assertIsNone(r.json()["user_id"])
            self.assertEqual(r.json()["name"], "")
        self.assertFalse(Membership.objects.filter(user=existing, business=self.biz).exists())

    def test_claimed_on_next_login(self):
        existing, _ = make_member("e", email="exists@e.com")
        jpost(self.client, self.url, {"email": "exists@e.com", "role": "seller"})
        self.client.force_login(existing)
        self.assertEqual(self.client.get("/api/me/").status_code, 200)
        self.assertEqual(Membership.objects.get(user=existing, business=self.biz).role, "seller")


class LastOwnerTests(TestCase):
    def test_last_owner_protected_under_atomic_lock(self):
        owner, biz = make_member("o")
        self.client.force_login(owner)
        m = Membership.objects.get(user=owner, business=biz)
        base = f"/api/businesses/{biz.id}/members/{m.id}/"
        self.assertEqual(self.client.delete(base).status_code, 400)
        self.assertEqual(jpatch(self.client, base, {"role": "seller"}).status_code, 400)
        with mock.patch("accounts.views.Membership.objects.select_for_update", wraps=Membership.objects.select_for_update) as sfu:
            self.client.delete(base)
        sfu.assert_called()


class JsonContentTypeTests(TestCase):
    def test_non_json_content_type_rejected(self):
        r = self.client.post("/api/auth/email/request/", "email=a@b.com", content_type="application/x-www-form-urlencoded")
        self.assertEqual(r.status_code, 415)
        self.assertEqual(r.json(), {"error": "unsupported_media_type"})
        r = self.client.post("/api/auth/email/request/", "{}", content_type="text/plain")
        self.assertEqual(r.status_code, 415)
