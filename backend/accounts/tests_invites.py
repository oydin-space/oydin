from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from accounts.models import Invite, Membership
from accounts.tests import jpatch, jpost, make_member


class InviteLinkTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.biz = make_member("own", role="owner")
        self.accountant, _ = make_member("acc", business=self.biz, role="accountant")
        self.seller, _ = make_member("sel", business=self.biz, role="seller")
        self.url = f"/api/businesses/{self.biz.id}/invites/"

    def create(self, **body):
        self.client.force_login(self.owner)
        return jpost(self.client, self.url, {"role": "accountant", **body})

    def test_owner_creates_and_lists(self):
        r = self.create(max_uses=3, expires_in_hours=2)
        self.assertEqual(r.status_code, 201)
        data = r.json()
        self.assertEqual((data["role"], data["max_uses"], data["uses"], data["status"]), ("accountant", 3, 0, "active"))
        self.assertGreater(len(data["code"]), 20)
        self.assertEqual(len(self.client.get(self.url).json()["items"]), 1)

    def test_owner_role_not_invitable_and_bad_params(self):
        self.assertEqual(self.create(role="owner").status_code, 400)
        self.assertEqual(self.create(max_uses=0).status_code, 400)
        self.assertEqual(self.create(expires_in_hours=0).status_code, 400)
        self.assertEqual(self.create(max_uses="x").status_code, 400)

    def test_non_owners_cannot_create_list_or_revoke(self):
        invite = Invite.objects.create(business=self.biz, code="c1", role="seller", expires_at=timezone.now() + timedelta(days=1))
        for user in (self.accountant, self.seller):
            self.client.force_login(user)
            self.assertEqual(jpost(self.client, self.url, {"role": "seller"}).status_code, 403)
            self.assertEqual(self.client.get(self.url).status_code, 403)
            self.assertEqual(self.client.delete(f"{self.url}{invite.id}/").status_code, 403)
        invite.refresh_from_db()
        self.assertIsNone(invite.revoked_at)

    def test_unauthenticated_and_outsider_forbidden(self):
        self.assertEqual(jpost(self.client, self.url, {"role": "seller"}).status_code, 401)
        outsider, _ = make_member("out")
        self.client.force_login(outsider)
        self.assertEqual(jpost(self.client, self.url, {"role": "seller"}).status_code, 403)

    def test_creation_is_rate_limited(self):
        for _ in range(20):
            self.assertEqual(self.create().status_code, 201)
        self.assertEqual(self.create().status_code, 429)

    def test_revoke_blocks_join(self):
        code = self.create().json()
        self.assertEqual(self.client.delete(f"{self.url}{code['id']}/").status_code, 204)
        self.client.logout()
        self.assertEqual(self.client.get(f"/api/invites/{code['code']}/").status_code, 410)
        newbie, _ = make_member("new")
        self.client.force_login(newbie)
        r = jpost(self.client, f"/api/invites/{code['code']}/accept/")
        self.assertEqual((r.status_code, r.json()["error"]), (410, "invite_revoked"))

    def test_revoke_other_business_invite_404(self):
        _, other = make_member("o2")
        foreign = Invite.objects.create(business=other, code="f", role="seller", expires_at=timezone.now() + timedelta(days=1))
        self.client.force_login(self.owner)
        self.assertEqual(self.client.delete(f"{self.url}{foreign.id}/").status_code, 404)

    def test_preview_public_shows_business_and_role_only(self):
        code = self.create(role="seller").json()["code"]
        self.client.logout()
        r = self.client.get(f"/api/invites/{code}/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(set(r.json()), {"business_name", "role", "expires_at"})
        self.assertEqual(r.json()["role"], "seller")
        self.assertEqual(self.client.get("/api/invites/nope/").status_code, 404)

    def test_accept_creates_membership_and_switches_business(self):
        code = self.create(role="seller").json()["code"]
        newbie, own = make_member("new")
        self.client.force_login(newbie)
        r = jpost(self.client, f"/api/invites/{code}/accept/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual((r.json()["active_business_id"], r.json()["role"]), (self.biz.id, "seller"))
        self.assertTrue(Membership.objects.filter(user=newbie, business=self.biz, role="seller").exists())
        self.assertEqual(Invite.objects.get(code=code).uses, 1)

    def test_accept_requires_login(self):
        code = self.create().json()["code"]
        self.client.logout()
        self.assertEqual(jpost(self.client, f"/api/invites/{code}/accept/").status_code, 401)

    def test_max_uses_and_expiry(self):
        code = self.create(max_uses=1).json()["code"]
        a, _ = make_member("a")
        b, _ = make_member("b")
        self.client.force_login(a)
        self.assertEqual(jpost(self.client, f"/api/invites/{code}/accept/").status_code, 200)
        self.client.force_login(b)
        self.assertEqual(jpost(self.client, f"/api/invites/{code}/accept/").json()["error"], "invite_used_up")
        Invite.objects.filter(code=code).update(max_uses=5, expires_at=timezone.now() - timedelta(seconds=1))
        self.assertEqual(jpost(self.client, f"/api/invites/{code}/accept/").json()["error"], "invite_expired")

    def test_existing_member_not_downgraded_or_counted(self):
        code = self.create(role="seller").json()["code"]
        self.client.force_login(self.owner)
        r = jpost(self.client, f"/api/invites/{code}/accept/")
        self.assertEqual((r.status_code, r.json()["role"]), (200, "owner"))
        self.assertEqual(Invite.objects.get(code=code).uses, 0)


class DemoAcceptTests(TestCase):
    def test_demo_user_cannot_accept(self):
        from accounts.services import DEMO_USERNAME
        from django.contrib.auth import get_user_model

        owner, business = make_member("inv_own")
        demo = get_user_model().objects.create(username=DEMO_USERNAME)
        invite = Invite.objects.create(
            business=business, code="c" * 20, role="seller", created_by=owner, expires_at=timezone.now() + timedelta(days=1)
        )
        self.client.force_login(demo)
        r = jpost(self.client, f"/api/invites/{invite.code}/accept/", {})
        self.assertEqual(r.status_code, 403)
        self.assertFalse(Membership.objects.filter(user=demo, business=business).exists())

    def test_demo_user_login_resets_business(self):
        from accounts.models import Business, Profile
        from accounts.services import demo_user
        from finance.seed import seed_demo

        user = seed_demo()
        other = Business.objects.create(name="X")
        Membership.objects.create(user=user, business=other, role="owner")
        Profile.objects.filter(user=user).update(business=other)
        self.assertTrue(demo_user().profile.business.is_demo)


class MemberPermissionTests(TestCase):
    def setUp(self):
        self.owner, self.biz = make_member("own", role="owner")
        self.accountant, _ = make_member("acc", business=self.biz, role="accountant")
        self.seller, _ = make_member("sel", business=self.biz, role="seller")
        self.base = f"/api/businesses/{self.biz.id}/members/"

    def test_only_owner_invites_by_email(self):
        for user in (self.accountant, self.seller):
            self.client.force_login(user)
            self.assertEqual(jpost(self.client, self.base, {"email": "x@e.com", "role": "seller"}).status_code, 403)
        self.client.force_login(self.owner)
        self.assertEqual(jpost(self.client, self.base, {"email": "x@e.com", "role": "seller"}).status_code, 201)

    def test_only_owner_changes_roles_and_removes(self):
        target = Membership.objects.get(user=self.seller)
        for user in (self.accountant, self.seller):
            self.client.force_login(user)
            self.assertEqual(jpatch(self.client, f"{self.base}{target.id}/", {"role": "owner"}).status_code, 403)
            self.assertEqual(self.client.delete(f"{self.base}{target.id}/").status_code, 403)
        self.client.force_login(self.owner)
        self.assertEqual(jpatch(self.client, f"{self.base}{target.id}/", {"role": "accountant"}).status_code, 200)
        self.assertEqual(self.client.delete(f"{self.base}{target.id}/").status_code, 204)

    def test_cannot_remove_or_demote_last_owner(self):
        mine = Membership.objects.get(user=self.owner)
        self.client.force_login(self.owner)
        self.assertEqual(self.client.delete(f"{self.base}{mine.id}/").json()["error"], "last_owner")
        self.assertEqual(jpatch(self.client, f"{self.base}{mine.id}/", {"role": "seller"}).json()["error"], "last_owner")
