from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase

from accounts.models import Business, Profile
from finance import services as svc
from finance.domain.forecast import Flow, build_forecast, find_gap
from finance.models import Account, Transaction
from finance.seed import seed_demo

D = date(2026, 1, 1)


class ForecastTests(SimpleTestCase):
    def test_gap_found_on_first_negative_day(self):
        flows = [Flow(D + timedelta(days=5), -3_000_000, "Зарплата")]
        points = build_forecast(D, 1_000_000, flows, 0, 0, 30)
        gap = find_gap(points, flows, D)
        self.assertEqual(gap.date, D + timedelta(days=5))
        self.assertEqual(gap.amount, 2_000_000)

    def test_no_gap(self):
        points = build_forecast(D, 5_000_000, [Flow(D + timedelta(days=3), -1_000_000, "x")], 0, 0, 30)
        self.assertIsNone(find_gap(points, [], D))


class DemoSeedTests(TestCase):
    def test_seed_has_visible_gap(self):
        user = seed_demo()
        pulse = svc.pulse(user.profile.business)
        self.assertIsNotNone(pulse["gap"])
        self.assertEqual(pulse["gap"]["amount"], 3_000_000)
        self.assertGreater(pulse["balance"], 0)


def make_user(name):
    user = get_user_model().objects.create(username=name)
    business = Business.objects.create(name=name)
    Profile.objects.create(user=user, business=business)
    account = Account.objects.create(business=business, name="Наличные", kind="cash")
    return user, business, account


class TransactionApiTests(TestCase):
    def setUp(self):
        self.user, self.business, self.account = make_user("a")
        self.other_user, self.other_business, self.other_account = make_user("b")
        self.client.force_login(self.user)

    def test_unauthenticated(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/transactions/").status_code, 401)

    def test_create_and_balance(self):
        body = {"amount": 500_000, "direction": "in", "category": "Розница", "account_id": self.account.id}
        r = self.client.post("/api/transactions/", body, content_type="application/json")
        self.assertEqual(r.status_code, 201)
        self.assertEqual(svc.list_accounts(self.business)[0]["balance"], 500_000)

    def test_rejects_foreign_account_and_bad_amount(self):
        body = {"amount": 1, "direction": "in", "category": "x", "account_id": self.other_account.id}
        self.assertEqual(self.client.post("/api/transactions/", body, content_type="application/json").status_code, 400)
        body = {"amount": 1.5, "direction": "in", "category": "x", "account_id": self.account.id}
        self.assertEqual(self.client.post("/api/transactions/", body, content_type="application/json").status_code, 400)

    def test_other_business_transaction_is_404(self):
        tx = Transaction.objects.create(
            business=self.other_business, account=self.other_account, date=D, amount=1000, direction="in", category="x"
        )
        self.assertEqual(self.client.delete(f"/api/transactions/{tx.id}/").status_code, 404)
        self.assertEqual(self.client.get("/api/transactions/").json()["items"], [])
        self.assertTrue(Transaction.objects.filter(pk=tx.pk).exists())
