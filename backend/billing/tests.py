from django.core.cache import cache
from django.test import TestCase, override_settings

from accounts.models import Membership
from finance.tests import add_member, jpost, make_user

from . import click
from .models import Payment, Plan, Subscription

CLICK = dict(PAYMENTS_ENABLED=True, CLICK_SERVICE_ID="111", CLICK_MERCHANT_ID="222", CLICK_MERCHANT_USER_ID="333", CLICK_SECRET_KEY="s3cret")


class PlansTests(TestCase):
    def test_localized_ordered_hidden(self):
        r = self.client.get("/api/billing/plans/?lang=uz")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Cache-Control"], "public, max-age=300")
        plans = r.json()["plans"]
        self.assertEqual([p["code"] for p in plans], ["free", "pro", "team"])
        self.assertEqual([p["popular"] for p in plans], [False, True, False])
        self.assertEqual(plans[0]["name"], "Bepul")
        self.assertEqual(plans[1]["price_uzs"], 149000)
        self.assertEqual(plans[1]["image"], "/pricing/pro.webp")
        self.assertEqual(self.client.get("/api/billing/plans/?lang=en").json()["plans"][0]["name"], "Free")
        Plan.objects.filter(code="team").update(is_active=False)
        self.assertEqual(len(self.client.get("/api/billing/plans/").json()["plans"]), 2)

    def test_single_popular(self):
        Plan.objects.get(code="team").save()
        team = Plan.objects.get(code="team")
        team.is_popular = True
        team.save()
        self.assertEqual(list(Plan.objects.filter(is_popular=True).values_list("code", flat=True)), ["team"])


class CheckoutTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner, self.business, _ = make_user("bill_owner")
        Membership.objects.update_or_create(user=self.owner, business=self.business, defaults={"role": "owner"})
        self.seller = add_member(self.business, "bill_seller", "seller")

    def test_non_owner_forbidden(self):
        self.client.force_login(self.seller)
        r = jpost(self.client, "/api/billing/checkout/", {"plan": "pro"})
        self.assertEqual((r.status_code, r.json()["error"]), (403, "forbidden"))

    def test_validation_and_disabled(self):
        self.client.force_login(self.owner)
        self.assertEqual(jpost(self.client, "/api/billing/checkout/", {"plan": "x"}).json()["error"], "unknown_plan")
        self.assertEqual(jpost(self.client, "/api/billing/checkout/", {"plan": "free"}).json()["error"], "free_plan")
        self.assertEqual(jpost(self.client, "/api/billing/checkout/", {"plan": "pro"}).json(), {"available": False})
        self.assertEqual(self.client.get("/api/billing/subscription/").json(), {"plan": "free", "status": "free", "renews_at": None})

    @override_settings(**CLICK)
    def test_enabled(self):
        self.client.force_login(self.owner)
        r = jpost(self.client, "/api/billing/checkout/", {"plan": "pro"}).json()
        self.assertTrue(r["available"])
        self.assertTrue(r["url"].startswith("https://my.click.uz/services/pay?service_id=111&merchant_id=222&amount=149000&transaction_param="))
        self.assertEqual(Payment.objects.get().status, "pending")
        self.assertEqual(self.client.get("/api/billing/subscription/").json()["status"], "pending")

    @override_settings(PAYMENTS_ENABLED=True, CLICK_SERVICE_ID="", CLICK_SECRET_KEY="")
    def test_missing_creds(self):
        self.client.force_login(self.owner)
        self.assertEqual(jpost(self.client, "/api/billing/checkout/", {"plan": "pro"}).json(), {"available": False})


@override_settings(**CLICK)
class ClickTests(TestCase):
    def setUp(self):
        _, self.business, _ = make_user("click_owner")
        self.payment = Payment.objects.create(business=self.business, plan=Plan.objects.get(code="pro"), amount_uzs=149000)

    def data(self, complete=False, **over):
        d = {
            "click_trans_id": "9001", "service_id": "111", "click_paydoc_id": "5", "merchant_trans_id": str(self.payment.pk),
            "amount": "149000", "action": "1" if complete else "0", "error": "0", "sign_time": "2026-11-18 10:00:00",
        }
        if complete:
            d["merchant_prepare_id"] = str(self.payment.pk)
        d.update(over)
        d["sign_string"] = over.get("sign_string") or click.sign(d, complete=complete)
        return d

    def call(self, step, data):
        return self.client.post(f"/api/billing/click/{step}/", data).json()

    def test_flow_and_idempotent(self):
        r = self.call("prepare", self.data())
        self.assertEqual((r["error"], r["merchant_prepare_id"]), (0, self.payment.pk))
        r = self.call("complete", self.data(True))
        self.assertEqual((r["error"], r["merchant_confirm_id"]), (0, self.payment.pk))
        sub = Subscription.objects.get(business=self.business)
        self.assertEqual((sub.status, sub.plan.code), ("active", "pro"))
        self.assertIsNotNone(sub.renews_at)
        self.assertEqual(self.client.get("/api/billing/subscription/").status_code, 401)
        self.assertEqual(self.call("complete", self.data(True))["error"], -4)
        self.assertEqual(self.call("prepare", self.data())["error"], -4)

    def test_bad_sign(self):
        self.assertEqual(self.call("prepare", self.data(sign_string="0" * 32))["error"], -1)
        self.assertEqual(self.call("complete", self.data(True, sign_string="bad"))["error"], -1)
        self.assertFalse(Subscription.objects.exists())

    def test_wrong_amount(self):
        self.assertEqual(self.call("prepare", self.data(amount="1000"))["error"], -2)
        self.call("prepare", self.data())
        self.assertEqual(self.call("complete", self.data(True, amount="1000"))["error"], -2)
        self.assertFalse(Subscription.objects.exists())

    def test_order_and_transaction_not_found(self):
        self.assertEqual(self.call("prepare", self.data(merchant_trans_id="999999"))["error"], -5)
        self.assertEqual(self.call("complete", self.data(True))["error"], -6)

    def test_cancelled_by_click(self):
        self.call("prepare", self.data())
        self.assertEqual(self.call("complete", self.data(True, error="-5017"))["error"], -9)
        self.assertEqual(Payment.objects.get().status, "cancelled")
        self.assertFalse(Subscription.objects.exists())
