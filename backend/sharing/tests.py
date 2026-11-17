import json
from datetime import timedelta

from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone

from accounts.models import Business
from accounts.tests import make_member
from finance.models import Account, Obligation, Transaction

from . import services as svc
from .models import Partner, PartnerConsent, PartnerStaff, ShareLink


def seed(business, amount=5_000_000, secret_note="СЕКРЕТНАЯ ЗАМЕТКА"):
    account = Account.objects.create(business=business, name="Касса", kind="cash", opening_balance=1_000_000)
    day = timezone.localdate() - timedelta(days=5)
    Transaction.objects.create(business=business, account=account, date=day, amount=amount, direction="in",
                               category="Продажи", counterparty="Клиент Иванов", note=secret_note)
    Transaction.objects.create(business=business, account=account, date=day, amount=123_456, direction="out",
                               category="Кофе", purpose="personal")
    Obligation.objects.create(business=business, title="Аренда", kind="rent", amount=900_000,
                              due_date=timezone.localdate() + timedelta(days=5))
    return account


def jpost(client, url, body=None):
    return client.post(url, body or {}, content_type="application/json")


class ShareLinkTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.biz = make_member("owner")
        self.other_owner, self.other_biz = make_member("other")
        seed(self.biz)
        seed(self.other_biz, secret_note="ЧУЖАЯ ЗАМЕТКА")
        self.client.force_login(self.owner)

    def create(self, body=None):
        response = jpost(self.client, "/api/share-links/", body if body is not None else {"period_from": str(timezone.localdate() - timedelta(days=30)),
                                                                   "period_to": str(timezone.localdate())})
        self.assertEqual(response.status_code, 201, response.content)
        data = response.json()
        return data, data["url"].rsplit("/", 1)[1]

    def test_token_is_long_and_stored_hashed(self):
        data, token = self.create()
        self.assertGreaterEqual(len(token), 32)
        link = ShareLink.objects.get(pk=data["id"])
        self.assertNotEqual(link.token_hash, token)
        self.assertEqual(link.token_hash, svc.hash_token(token))
        listed = self.client.get("/api/share-links/").json()["items"][0]
        self.assertNotIn(token, json.dumps(listed))

    def test_defaults_previous_month_30_days(self):
        data, _ = self.create({})
        first, last = svc.previous_month(timezone.localdate())
        self.assertEqual((data["period_from"], data["period_to"]), (first.isoformat(), last.isoformat()))
        expires = ShareLink.objects.get(pk=data["id"]).expires_at
        self.assertAlmostEqual((expires - timezone.now()).days, 29, delta=1)

    def test_public_report_no_auth_and_no_pii(self):
        _, token = self.create()
        self.client.logout()
        response = self.client.get(f"/api/shared/{token}/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("noindex", response["X-Robots-Tag"])
        text = response.content.decode()
        body = response.json()
        self.assertEqual(body["business_name"], self.biz.name)
        self.assertEqual(body["period"]["revenue"], 5_000_000)
        for secret in ("СЕКРЕТНАЯ", "Клиент Иванов", "ЧУЖАЯ", "Кофе"):
            self.assertNotIn(secret, text)
        self.assertEqual(ShareLink.objects.get().views, 1)

    def test_no_cross_tenant_leak(self):
        _, token = self.create()
        body = self.client.get(f"/api/shared/{token}/").json()
        self.assertEqual(body["business_name"], self.biz.name)
        self.assertEqual(len(body["accounts"]), 1)
        self.assertEqual(body["accounts"][0]["balance"], 1_000_000 + 5_000_000 - 123_456)
        # чужой владелец не видит и не отзывает чужую ссылку
        self.client.force_login(self.other_owner)
        link_id = ShareLink.objects.get().id
        self.assertEqual(self.client.get(f"/api/share-links/{link_id}/").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/share-links/{link_id}/").status_code, 404)
        self.assertEqual(self.client.get("/api/share-links/").json()["items"], [])

    def test_unknown_token_404(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/shared/" + "a" * 43 + "/").status_code, 404)
        self.assertEqual(self.client.get("/api/shared/" + "a" * 43 + "/report.pdf").status_code, 404)

    def test_expired_and_revoked_are_unavailable(self):
        data, token = self.create()
        ShareLink.objects.filter(pk=data["id"]).update(expires_at=timezone.now() - timedelta(seconds=1))
        r = self.client.get(f"/api/shared/{token}/")
        self.assertEqual((r.status_code, r.json()), (410, {"error": "expired"}))
        self.assertEqual(self.client.get(f"/api/shared/{token}/report.pdf").status_code, 410)
        data, token = self.create()
        self.assertEqual(self.client.delete(f"/api/share-links/{data['id']}/").status_code, 204)
        r = self.client.get(f"/api/shared/{token}/")
        self.assertEqual((r.status_code, r.json()), (410, {"error": "revoked"}))
        # запись остаётся в списке
        item = [i for i in self.client.get("/api/share-links/").json()["items"] if i["id"] == data["id"]][0]
        self.assertIsNotNone(item["revoked_at"])

    def test_max_expiry_and_validation(self):
        far = (timezone.now() + timedelta(days=400)).isoformat()
        self.assertEqual(jpost(self.client, "/api/share-links/", {"expires_at": far}).status_code, 400)
        self.assertEqual(jpost(self.client, "/api/share-links/",
                               {"period_from": "2026-02-01", "period_to": "2026-01-01"}).status_code, 400)

    def test_patch_label_and_expiry(self):
        data, _ = self.create()
        new_exp = (timezone.now() + timedelta(days=60)).isoformat()
        r = self.client.patch(f"/api/share-links/{data['id']}/", {"label": "Бухгалтер", "expires_at": new_exp},
                              content_type="application/json")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["label"], "Бухгалтер")

    def test_only_owner_manages(self):
        accountant, _ = make_member("acc", business=self.biz, role="accountant")
        self.client.force_login(accountant)
        self.assertEqual(self.client.get("/api/share-links/").status_code, 403)
        self.assertEqual(jpost(self.client, "/api/share-links/").status_code, 403)

    def test_pdf(self):
        _, token = self.create()
        self.client.logout()
        r = self.client.get(f"/api/shared/{token}/report.pdf")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "application/pdf")
        self.assertIn("attachment", r["Content-Disposition"])
        self.assertTrue(r.content.startswith(b"%PDF"))
        self.assertGreater(len(r.content), 5000)

    def test_pdf_renders_cyrillic_and_uzbek_latin(self):
        from . import pdf
        report = svc.shared_report(ShareLink.objects.get(pk=self.create()[0]["id"]))
        report["business_name"] = "Гулнора <b>Oʻzbek</b> & Gʻayrat"
        self.assertGreater(len(pdf.render(report)), 5000)

    def test_rate_limit(self):
        _, token = self.create()
        from . import views
        original = views.PUBLIC_LIMIT
        views.PUBLIC_LIMIT = 2
        try:
            codes = [self.client.get(f"/api/shared/{token}/").status_code for _ in range(4)]
        finally:
            views.PUBLIC_LIMIT = original
        self.assertEqual(codes, [200, 200, 429, 429])


class PartnerTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.biz = make_member("owner")
        self.biz.city = "Ташкент"
        self.biz.name = "ТАЙНОЕ ИМЯ"
        self.biz.save()
        seed(self.biz, amount=80_000_000)
        self.partner = Partner.objects.create(name="Банк А", kind="bank")
        self.other_partner = Partner.objects.create(name="МФО Б", kind="mfo")
        self.staff_user, _ = make_member("staff", email="s@bank.uz")
        PartnerStaff.objects.create(user=self.staff_user, partner=self.partner)

    def grant(self, partner=None):
        self.client.force_login(self.owner)
        r = jpost(self.client, "/api/consents/partner/", {"partner_id": (partner or self.partner).id})
        self.assertEqual(r.status_code, 200, r.content)
        return r.json()

    def leads(self, user=None):
        self.client.force_login(user or self.staff_user)
        r = self.client.get("/api/partner/leads/")
        self.assertEqual(r.status_code, 200)
        return r.json()["items"]

    def test_consent_list_grant_revoke(self):
        self.client.force_login(self.owner)
        items = self.client.get("/api/consents/partner/").json()["items"]
        self.assertEqual({i["partner"]["id"] for i in items}, {self.partner.id, self.other_partner.id})
        self.assertFalse(any(i["granted"] for i in items))
        data = self.grant()
        self.assertTrue(data["granted"])
        self.assertIsNotNone(data["granted_at"])
        self.assertEqual(PartnerConsent.objects.get().text_version, svc.CONSENT_TEXT_VERSION)
        self.grant()  # идемпотентно
        self.assertEqual(PartnerConsent.objects.count(), 1)
        r = self.client.delete(f"/api/consents/partner/{self.partner.id}/")
        self.assertEqual(r.status_code, 200)
        self.assertFalse(r.json()["granted"])
        self.assertIsNotNone(r.json()["revoked_at"])

    def test_consent_validation_and_roles(self):
        self.client.force_login(self.owner)
        self.assertEqual(jpost(self.client, "/api/consents/partner/", {"partner_id": 9999}).status_code, 404)
        self.assertEqual(jpost(self.client, "/api/consents/partner/", {"partner_id": "x"}).status_code, 400)
        self.assertEqual(self.client.delete("/api/consents/partner/9999/").status_code, 404)
        seller, _ = make_member("seller", business=self.biz, role="seller")
        self.client.force_login(seller)
        self.assertEqual(jpost(self.client, "/api/consents/partner/", {"partner_id": self.partner.id}).status_code, 403)

    def test_partner_sees_nothing_without_consent(self):
        self.assertEqual(self.leads(), [])
        self.grant(self.other_partner)  # согласие другому партнёру не помогает
        self.assertEqual(self.leads(), [])

    def test_lead_is_anonymous_with_consent(self):
        self.grant()
        leads = self.leads()
        self.assertEqual(len(leads), 1)
        lead = leads[0]
        self.assertEqual(lead["revenue_band"], "50m-200m")
        self.assertEqual(lead["city"], "Ташкент")
        self.assertEqual(lead["status"], "new")
        text = json.dumps(lead, ensure_ascii=False)
        for forbidden in ("ТАЙНОЕ", "80000000", "Клиент", "СЕКРЕТНАЯ", "owner", str(self.biz.id) + '"'):
            self.assertNotIn(forbidden, text)
        self.assertEqual(set(lead), {"id", "segment", "city", "months_active", "revenue_band", "gap_amount_band",
                                     "gap_date", "consented_at", "status"})

    def test_revoke_removes_lead(self):
        self.grant()
        self.assertEqual(len(self.leads()), 1)
        self.client.force_login(self.owner)
        self.client.delete(f"/api/consents/partner/{self.partner.id}/")
        self.assertEqual(self.leads(), [])

    def test_mark_interest_and_filter(self):
        self.grant()
        lead_id = self.leads()[0]["id"]
        r = self.client.patch(f"/api/partner/leads/{lead_id}/", {"status": "contacted"}, content_type="application/json")
        self.assertEqual((r.status_code, r.json()["status"]), (200, "contacted"))
        self.assertEqual(len(self.client.get("/api/partner/leads/?status=contacted").json()["items"]), 1)
        self.assertEqual(self.client.get("/api/partner/leads/?status=new").json()["items"], [])
        bad = self.client.patch(f"/api/partner/leads/{lead_id}/", {"status": "x"}, content_type="application/json")
        self.assertEqual(bad.status_code, 400)

    def test_other_partner_cannot_touch_lead_and_revoked_is_404(self):
        self.grant()
        lead_id = self.leads()[0]["id"]
        rival, _ = make_member("rival")
        PartnerStaff.objects.create(user=rival, partner=self.other_partner)
        self.client.force_login(rival)
        r = self.client.patch(f"/api/partner/leads/{lead_id}/", {"status": "closed"}, content_type="application/json")
        self.assertEqual(r.status_code, 404)
        self.client.force_login(self.owner)
        self.client.delete(f"/api/consents/partner/{self.partner.id}/")
        self.client.force_login(self.staff_user)
        r = self.client.patch(f"/api/partner/leads/{lead_id}/", {"status": "closed"}, content_type="application/json")
        self.assertEqual(r.status_code, 404)

    def test_regrant_keeps_history(self):
        self.grant()
        self.client.delete(f"/api/consents/partner/{self.partner.id}/")
        self.grant()
        self.assertEqual(PartnerConsent.objects.count(), 2)
        self.assertEqual(len(self.leads()), 1)

    def test_non_staff_and_anonymous(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/partner/leads/").status_code, 401)
        self.client.force_login(self.owner)
        for url in ("/api/partner/me/", "/api/partner/leads/"):
            r = self.client.get(url)
            self.assertEqual((r.status_code, r.json()), (403, {"error": "not_partner"}))

    def test_partner_me(self):
        self.client.force_login(self.staff_user)
        data = self.client.get("/api/partner/me/").json()
        self.assertEqual(data["partner"]["name"], "Банк А")
        self.assertEqual(data["email"], "s@bank.uz")


class ImpactTests(TestCase):
    def setUp(self):
        cache.clear()

    def make(self, n, demo=False):
        for i in range(n):
            b = Business.objects.create(name=f"b{i}-{demo}", is_demo=demo)
            seed(b)

    def test_hidden_below_k(self):
        self.make(svc.K_THRESHOLD - 1)
        r = self.client.get("/api/impact/")
        data = r.json()
        self.assertEqual(r.status_code, 200)
        self.assertEqual((data["businesses"], data["operations_recorded"], data["gaps_flagged"]), (0, 0, 0))
        self.assertTrue(data["suppressed"])

    def test_shown_at_k_and_demo_excluded(self):
        self.make(svc.K_THRESHOLD)
        self.make(3, demo=True)
        data = self.client.get("/api/impact/").json()
        self.assertEqual(data["businesses"], svc.K_THRESHOLD)
        self.assertEqual(data["operations_recorded"], svc.K_THRESHOLD * 2)
        self.assertFalse(data["suppressed"])
        for key in ("cash_closes", "gaps_flagged", "updated_at"):
            self.assertIn(key, data)

    def test_small_sub_counters_hidden(self):
        self.make(svc.K_THRESHOLD)
        data = svc.compute_impact()
        self.assertLess(data["gaps_flagged"], svc.K_THRESHOLD)
        self.assertEqual(data["gaps_flagged"], 0)
