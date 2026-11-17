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


# ---------------------------------------------------------------- multi-tenancy, auth, admin
import re
from datetime import timedelta
from unittest import mock

from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.core.management import call_command
from django.utils import timezone

from accounts import google
from accounts.models import Business, EmailCode, Membership, Profile

User = get_user_model()


def make_member(username, business=None, role="owner", email=""):
    user = User.objects.create(username=username, email=email)
    business = business or Business.objects.create(name=f"biz-{username}")
    Profile.objects.get_or_create(user=user, defaults={"business": business})
    Membership.objects.update_or_create(user=user, business=business, defaults={"role": role})
    return user, business


def jpost(client, url, body=None):
    return client.post(url, body or {}, content_type="application/json")


def jpatch(client, url, body):
    return client.patch(url, body, content_type="application/json")


class ProfileMembershipTests(TestCase):
    def test_profile_with_business_creates_owner_membership(self):
        user = User.objects.create(username="legacy")
        business = Business.objects.create(name="L")
        Profile.objects.create(user=user, business=business)
        self.assertEqual(Membership.objects.get(user=user, business=business).role, "owner")


@override_settings(EMAIL_CONFIGURED=True, DEFAULT_FROM_EMAIL="noreply@oydin.test")
class EmailOtpTests(TestCase):
    def setUp(self):
        cache.clear()

    def request_code(self, email="Ali@Example.com", lang="ru"):
        return jpost(self.client, "/api/auth/email/request/", {"email": email, "lang": lang})

    def last_code(self):
        return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)

    def test_happy_path_creates_user_and_needs_onboarding(self):
        r = self.request_code()
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json(), {"ok": True, "resend_in": 60})
        self.assertEqual(mail.outbox[-1].to, ["ali@example.com"])
        code = self.last_code()
        self.assertNotIn(code, EmailCode.objects.get().code_hash)
        r = jpost(self.client, "/api/auth/email/verify/", {"email": "ALI@example.com ", "code": code})
        self.assertEqual(r.status_code, 200)
        me = r.json()
        self.assertEqual(me["email"], "ali@example.com")
        self.assertTrue(me["needs_onboarding"])
        self.assertEqual(me["businesses"], [])
        self.assertIsNone(me["active_business_id"])
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 200)
        # повторно код не работает
        self.client.logout()
        r = jpost(self.client, "/api/auth/email/verify/", {"email": "ali@example.com", "code": code})
        self.assertEqual(r.status_code, 400)

    def test_language_of_email(self):
        self.request_code(lang="uz")
        self.assertIn("kod", mail.outbox[-1].body.lower())
        cache.clear()
        self.request_code(email="b@example.com", lang="en")
        self.assertIn("code", mail.outbox[-1].body.lower())

    def test_existing_user_linked_by_email(self):
        user, _ = make_member("existing", email="ali@example.com")
        self.request_code()
        r = jpost(self.client, "/api/auth/email/verify/", {"email": "ali@example.com", "code": self.last_code()})
        self.assertEqual(r.json()["id"], user.id)
        self.assertFalse(r.json()["needs_onboarding"])

    def test_expired_code(self):
        self.request_code()
        code = self.last_code()
        EmailCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        r = jpost(self.client, "/api/auth/email/verify/", {"email": "ali@example.com", "code": code})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json(), {"error": "invalid_code"})

    def test_attempt_limit(self):
        self.request_code()
        code = self.last_code()
        wrong = "000000" if code != "000000" else "111111"
        for _ in range(5):
            r = jpost(self.client, "/api/auth/email/verify/", {"email": "ali@example.com", "code": wrong})
            self.assertEqual(r.status_code, 400)
        r = jpost(self.client, "/api/auth/email/verify/", {"email": "ali@example.com", "code": code})
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.json(), {"error": "rate_limited"})

    def test_resend_and_hourly_rate_limit(self):
        self.assertEqual(self.request_code().status_code, 200)
        r = self.request_code()
        self.assertEqual(r.status_code, 429)
        self.assertEqual(r.json(), {"error": "rate_limited"})
        EmailCode.objects.update(created_at=timezone.now() - timedelta(minutes=2))
        for _ in range(4):
            self.assertEqual(self.request_code().status_code, 200)
            EmailCode.objects.update(created_at=timezone.now() - timedelta(minutes=2))
        self.assertEqual(self.request_code().status_code, 429)

    def test_ip_rate_limit(self):
        for i in range(20):
            self.assertEqual(self.request_code(email=f"u{i}@example.com").status_code, 200)
        self.assertEqual(self.request_code(email="last@example.com").status_code, 429)

    def test_invalid_email(self):
        self.assertEqual(self.request_code(email="nope").status_code, 400)

    @override_settings(EMAIL_CONFIGURED=False)
    def test_not_configured(self):
        r = self.request_code()
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json(), {"error": "email_not_configured"})

    def test_pending_invite_claimed_on_first_login(self):
        _, business = make_member("boss")
        Membership.objects.create(business=business, invited_email="ali@example.com", role="accountant")
        self.request_code()
        me = jpost(self.client, "/api/auth/email/verify/", {"email": "ali@example.com", "code": self.last_code()}).json()
        self.assertFalse(me["needs_onboarding"])
        self.assertEqual(me["active_business_id"], business.id)
        self.assertEqual(me["role"], "accountant")
        self.assertFalse(Membership.objects.filter(user__isnull=True).exists())


GOOGLE = {"GOOGLE_CLIENT_ID": "cid.apps.googleusercontent.com", "GOOGLE_CLIENT_SECRET": "secret"}


@override_settings(**GOOGLE)
class GoogleOAuthTests(TestCase):
    def start(self, next_url="/app"):
        r = self.client.get("/api/auth/google/start/", {"next": next_url})
        self.assertEqual(r.status_code, 302)
        self.assertTrue(r["Location"].startswith("https://accounts.google.com/"))
        self.assertIn("code_challenge_method=S256", r["Location"])
        return self.client.session["google_oauth"]

    def claims(self, flow, **over):
        base = {
            "aud": GOOGLE["GOOGLE_CLIENT_ID"], "iss": "https://accounts.google.com", "sub": "g-1",
            "exp": str(int(time.time()) + 600), "email": "Ali@Example.com", "email_verified": "true",
            "nonce": flow["nonce"], "name": "Ali",
        }
        return {**base, **over}

    def callback(self, flow, claims, state=None):
        token = mock.Mock(status_code=200, json=lambda: {"id_token": "jwt"})
        info = mock.Mock(status_code=200, json=lambda: claims)
        with mock.patch.object(google.httpx, "post", return_value=token) as post, \
                mock.patch.object(google.httpx, "get", return_value=info):
            r = self.client.get("/api/auth/google/callback/", {"code": "c", "state": state or flow["state"]})
        return r, post

    def test_happy_path(self):
        flow = self.start()
        r, post = self.callback(flow, self.claims(flow))
        self.assertEqual(r.status_code, 302)
        self.assertEqual(r["Location"], "/app")
        self.assertIn("code_verifier", post.call_args.kwargs["data"])
        me = self.client.get("/api/auth/me/").json()
        self.assertEqual(me["email"], "ali@example.com")
        self.assertTrue(me["needs_onboarding"])
        self.assertEqual(Profile.objects.get(user_id=me["id"]).google_sub, "g-1")

    def test_links_existing_user_by_email(self):
        user, _ = make_member("e", email="ali@example.com")
        flow = self.start()
        self.callback(flow, self.claims(flow))
        self.assertEqual(self.client.get("/api/auth/me/").json()["id"], user.id)

    def test_bad_state(self):
        flow = self.start()
        r, post = self.callback(flow, self.claims(flow), state="forged")
        self.assertEqual(r.status_code, 302)
        self.assertIn("auth_error=invalid_state", r["Location"])
        post.assert_not_called()
        self.assertEqual(self.client.get("/api/auth/me/").status_code, 401)

    def test_rejects_bad_claims(self):
        for over in ({"aud": "other"}, {"iss": "evil"}, {"exp": "1"}, {"email_verified": "false"}, {"nonce": "x"}):
            self.client.logout()
            flow = self.start()
            r, _ = self.callback(flow, self.claims(flow, **over))
            self.assertIn("auth_error=", r["Location"], over)
            self.assertEqual(self.client.get("/api/auth/me/").status_code, 401, over)

    def test_unsafe_next_ignored(self):
        flow = self.start(next_url="https://evil.example/")
        r, _ = self.callback(flow, self.claims(flow))
        self.assertEqual(r["Location"], "/app")
        flow = self.start(next_url="//evil.example/")
        self.assertEqual(flow["next"], "/app")

    @override_settings(GOOGLE_CLIENT_ID="", GOOGLE_CLIENT_SECRET="")
    def test_not_configured(self):
        r = self.client.get("/api/auth/google/start/")
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json(), {"error": "google_not_configured"})


class ProvidersTests(TestCase):
    @override_settings(EMAIL_CONFIGURED=True, GOOGLE_CLIENT_ID="", TELEGRAM_BOT_TOKEN="t", DEMO_LOGIN=False)
    def test_flags(self):
        r = self.client.get("/api/auth/providers/")
        self.assertEqual(r.json(), {"email": True, "google": False, "telegram": True, "demo": False})


class TenancyTests(TestCase):
    def setUp(self):
        self.owner, self.biz = make_member("owner", email="owner@example.com")
        self.client.force_login(self.owner)

    def test_me_lists_businesses(self):
        other = Business.objects.create(name="Second", is_demo=True)
        Membership.objects.create(user=self.owner, business=other, role="seller")
        me = self.client.get("/api/auth/me/").json()
        self.assertEqual(me["role"], "owner")
        self.assertEqual(me["active_business_id"], self.biz.id)
        self.assertFalse(me["needs_onboarding"])
        self.assertEqual(
            me["businesses"],
            [{"id": self.biz.id, "name": self.biz.name, "role": "owner", "is_demo": False},
             {"id": other.id, "name": "Second", "role": "seller", "is_demo": True}],
        )

    def test_create_business_becomes_active_owner(self):
        r = jpost(self.client, "/api/businesses/", {"name": "Кафе", "industry": "HoReCa", "city": "Ташкент"})
        self.assertEqual(r.status_code, 201)
        item = r.json()
        self.assertEqual(item["role"], "owner")
        me = self.client.get("/api/auth/me/").json()
        self.assertEqual(me["active_business_id"], item["id"])
        self.assertEqual(len(self.client.get("/api/businesses/").json()["items"]), 2)
        self.assertEqual(len(self.client.get("/api/accounts/").json()["items"]), 3)

    def test_create_business_requires_name(self):
        self.assertEqual(jpost(self.client, "/api/businesses/", {"name": " "}).status_code, 400)

    def test_onboarding_user_without_business(self):
        user = User.objects.create(username="fresh")
        self.client.force_login(user)
        self.assertTrue(self.client.get("/api/auth/me/").json()["needs_onboarding"])
        r = self.client.get("/api/accounts/")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(r.json(), {"error": "no_business"})

    def test_switch(self):
        other_user, other = make_member("x")
        self.assertEqual(jpost(self.client, f"/api/businesses/{other.id}/switch/").status_code, 403)
        Membership.objects.create(user=self.owner, business=other, role="accountant")
        r = jpost(self.client, f"/api/businesses/{other.id}/switch/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["active_business_id"], other.id)
        self.assertEqual(r.json()["role"], "accountant")
        self.owner.profile.refresh_from_db()
        self.assertEqual(self.owner.profile.business_id, other.id)

    def test_patch_business_owner_only(self):
        r = jpatch(self.client, f"/api/businesses/{self.biz.id}/", {"name": "New", "city": "Самарканд"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["name"], "New")
        acc, _ = make_member("acc", business=self.biz, role="accountant")
        self.client.force_login(acc)
        self.assertEqual(jpatch(self.client, f"/api/businesses/{self.biz.id}/", {"name": "X"}).status_code, 403)
        _, foreign = make_member("y")
        self.assertEqual(jpatch(self.client, f"/api/businesses/{foreign.id}/", {"name": "X"}).status_code, 403)

    def test_invite_existing_and_pending(self):
        existing = User.objects.create(username="ex", email="ex@example.com")
        url = f"/api/businesses/{self.biz.id}/members/"
        r = jpost(self.client, url, {"email": "EX@example.com", "role": "seller"})
        self.assertEqual(r.status_code, 201)
        self.assertIsNone(r.json()["user_id"])
        self.assertTrue(r.json()["pending"])
        r = jpost(self.client, url, {"email": "new@example.com", "role": "accountant"})
        self.assertEqual(r.status_code, 201)
        self.assertTrue(r.json()["pending"])
        self.assertEqual(jpost(self.client, url, {"email": "new@example.com", "role": "seller"}).status_code, 400)
        self.assertEqual(jpost(self.client, url, {"email": "z@example.com", "role": "admin"}).status_code, 400)
        self.assertEqual(len(self.client.get(url).json()["items"]), 3)
        # приглашённый видит бизнес в списке
        self.client.force_login(existing)
        self.client.get("/api/me/")  # claim_invites привязывает приглашение при входе
        ids = [b["id"] for b in self.client.get("/api/businesses/").json()["items"]]
        self.assertEqual(ids, [self.biz.id])

    def test_members_owner_only(self):
        acc, _ = make_member("acc", business=self.biz, role="accountant")
        self.client.force_login(acc)
        url = f"/api/businesses/{self.biz.id}/members/"
        self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(jpost(self.client, url, {"email": "a@b.co", "role": "seller"}).status_code, 403)

    def test_last_owner_guard(self):
        mine = Membership.objects.get(user=self.owner, business=self.biz)
        url = f"/api/businesses/{self.biz.id}/members/{mine.id}/"
        r = jpatch(self.client, url, {"role": "seller"})
        self.assertEqual(r.status_code, 400)
        self.assertEqual(r.json(), {"error": "last_owner"})
        self.assertEqual(self.client.delete(url).status_code, 400)
        co, _ = make_member("co", business=self.biz, role="seller")
        co_m = Membership.objects.get(user=co, business=self.biz)
        self.assertEqual(jpatch(self.client, f"/api/businesses/{self.biz.id}/members/{co_m.id}/", {"role": "owner"}).status_code, 200)
        self.assertEqual(jpatch(self.client, url, {"role": "accountant"}).status_code, 200)

    def test_remove_member_clears_active_business(self):
        seller, _ = make_member("s", business=self.biz, role="seller")
        m = Membership.objects.get(user=seller, business=self.biz)
        self.assertEqual(self.client.delete(f"/api/businesses/{self.biz.id}/members/{m.id}/").status_code, 204)
        seller.profile.refresh_from_db()
        self.assertIsNone(seller.profile.business_id)
        self.client.force_login(seller)
        self.assertEqual(self.client.get("/api/transactions/").status_code, 403)

    def test_member_of_other_business_404(self):
        _, other = make_member("o2")
        m = Membership.objects.get(business=other)
        r = self.client.delete(f"/api/businesses/{self.biz.id}/members/{m.id}/")
        self.assertEqual(r.status_code, 404)
        self.assertTrue(Membership.objects.filter(pk=m.pk).exists())


class EnsureAdminTests(TestCase):
    def test_noop_without_env(self):
        with override_settings(ADMIN_EMAIL="", ADMIN_PASSWORD=""):
            call_command("ensure_admin")
        self.assertFalse(User.objects.filter(is_superuser=True).exists())

    def test_creates_superuser(self):
        with override_settings(ADMIN_EMAIL="Root@Oydin.uz", ADMIN_PASSWORD="s3cret-pass"):
            call_command("ensure_admin")
            call_command("ensure_admin")
        user = User.objects.get(is_superuser=True)
        self.assertTrue(user.is_staff)
        self.assertEqual(user.email, "root@oydin.uz")
        self.assertTrue(user.check_password("s3cret-pass"))
        self.assertTrue(self.client.login(username="root@oydin.uz", password="s3cret-pass"))
        self.assertEqual(self.client.get("/admin/accounts/membership/").status_code, 200)
        self.assertEqual(self.client.get("/admin/finance/transaction/").status_code, 200)

    def test_deactivate_action(self):
        admin = User.objects.create_superuser("root", "r@o.uz", "pw")
        victim = User.objects.create(username="v")
        self.client.force_login(admin)
        self.client.post("/admin/auth/user/", {"action": "deactivate_users", "_selected_action": [victim.id]})
        victim.refresh_from_db()
        self.assertFalse(victim.is_active)


class ConsentApiTests(TestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model

        from .models import Business, Membership, Profile

        self.user = get_user_model().objects.create(username="cons")
        self.business = Business.objects.create(name="cons")
        Profile.objects.create(user=self.user, business=self.business)
        self.client.force_login(self.user)

    def put(self, body):
        return self.client.put("/api/consents/", body, content_type="application/json")

    def test_requires_auth(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/consents/").status_code, 401)

    def test_defaults_off(self):
        data = self.client.get("/api/consents/").json()
        self.assertEqual((data["ai"], data["marketing"], data["partner_leads"], data["terms_version"]), (False, False, False, None))

    def test_grant_withdraw_logged(self):
        from .models import ConsentEvent

        data = self.put({"ai": True, "terms_version": "2026-11-18"}).json()
        self.assertTrue(data["ai"])
        self.assertEqual(data["terms_version"], "2026-11-18")
        self.assertIsNotNone(data["updated_at"])
        self.assertFalse(self.put({"ai": False}).json()["ai"])
        self.put({"ai": False})  # без изменения — не логируется
        events = list(ConsentEvent.objects.filter(user=self.user).values_list("purpose", "granted"))
        self.assertEqual(events, [("ai", True), ("ai", False)])

    def test_partial_update_keeps_others(self):
        self.put({"marketing": True})
        data = self.put({"partner_leads": True}).json()
        self.assertTrue(data["marketing"] and data["partner_leads"])
        self.assertFalse(data["ai"])

    def test_validation(self):
        self.assertEqual(self.put({"ai": "yes"}).status_code, 400)

    def test_per_user(self):
        from django.contrib.auth import get_user_model

        self.put({"ai": True})
        other = get_user_model().objects.create(username="other")
        self.client.force_login(other)
        self.assertFalse(self.client.get("/api/consents/").json()["ai"])


class AiConsentGateTests(TestCase):
    def setUp(self):
        from django.contrib.auth import get_user_model

        from .models import Business, Membership, Profile

        self.user = get_user_model().objects.create(username="gate")
        self.business = Business.objects.create(name="gate")
        Profile.objects.create(user=self.user, business=self.business)
        self.client.force_login(self.user)

    def chat(self):
        return self.client.post("/api/ai/chat/", {"messages": [{"role": "user", "content": "привет"}]}, content_type="application/json")

    def test_denied_without_consent_and_no_outbound_call(self):
        from unittest import mock

        with mock.patch("ai.llm.complete") as complete, mock.patch("ai.llm._post") as post, mock.patch("ai.observability.flush") as flush:
            r = self.chat()
            v = self.client.post("/api/ai/voice/")
            f = self.client.post("/api/ai/feedback/", {"trace_id": "t", "value": 1}, content_type="application/json")
        for resp in (r, v, f):
            self.assertEqual(resp.status_code, 403)
            self.assertEqual(resp.json(), {"error": "ai_consent_required"})
        complete.assert_not_called()
        post.assert_not_called()
        flush.assert_not_called()

    def test_allowed_with_consent(self):
        from .consent import set_consent

        set_consent(self.user, "ai", True)
        with override_settings(LLM_API_KEY="", ANTHROPIC_API_KEY=""):
            self.assertEqual(self.chat().status_code, 200)

    def test_withdrawal_blocks_again(self):
        from .consent import set_consent

        set_consent(self.user, "ai", True)
        set_consent(self.user, "ai", False)
        self.assertEqual(self.chat().status_code, 403)

    def test_seller_denied(self):
        from .consent import set_consent
        from .models import Membership

        set_consent(self.user, "ai", True)
        Membership.objects.filter(user=self.user).update(role=Membership.Role.SELLER)
        r = self.chat()
        self.assertEqual((r.status_code, r.json()), (403, {"error": "forbidden"}))

    def test_demo_has_consent(self):
        from finance.seed import seed_demo

        seed_demo()
        from .consent import has_consent
        from django.contrib.auth import get_user_model

        self.assertTrue(has_consent(get_user_model().objects.get(username="demo"), "ai"))
