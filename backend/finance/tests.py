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

    def test_category_reuses_existing_case_insensitively(self):
        def post(category, account=self.account):
            body = {"amount": 1000, "direction": "out", "category": category, "account_id": account.id}
            return self.client.post("/api/transactions/", body, content_type="application/json")

        self.assertEqual(post("Аренда").json()["category"], "Аренда")
        self.assertEqual(post("  аРЕНДА ").json()["category"], "Аренда")
        self.assertEqual(post("Аренда зала").json()["category"], "Аренда зала")
        self.assertEqual(Transaction.objects.filter(business=self.business).values("category").distinct().count(), 2)
        # Чужие категории не подмешиваются.
        self.assertEqual(post("АРЕНДА", self.other_account).status_code, 400)

    def test_other_business_transaction_is_404(self):
        tx = Transaction.objects.create(
            business=self.other_business, account=self.other_account, date=D, amount=1000, direction="in", category="x"
        )
        self.assertEqual(self.client.delete(f"/api/transactions/{tx.id}/").status_code, 404)
        self.assertEqual(self.client.get("/api/transactions/").json()["items"], [])
        self.assertTrue(Transaction.objects.filter(pk=tx.pk).exists())


# ---------------------------------------------------------------- tenancy, roles, currency
from decimal import Decimal
from unittest import mock

from django.core.management import call_command
from django.test import override_settings

from accounts.models import Membership
from finance import rates
from finance.models import ExchangeRate, Obligation


def add_member(business, username, role):
    user = get_user_model().objects.create(username=username)
    Profile.objects.create(user=user, business=None)
    Profile.objects.filter(user=user).update(business=business)
    Membership.objects.create(user=user, business=business, role=role)
    return user


def jpost(client, url, body):
    return client.post(url, body, content_type="application/json")


class TenantIsolationTests(TestCase):
    def setUp(self):
        self.user, self.business, self.account = make_user("a")
        self.other_user, self.other_business, self.other_account = make_user("b")
        self.other_tx = Transaction.objects.create(
            business=self.other_business, account=self.other_account, date=D, amount=1000, direction="in", category="x"
        )
        self.other_ob = Obligation.objects.create(
            business=self.other_business, title="t", kind="rent", amount=5, due_date=D
        )
        self.client.force_login(self.user)

    def test_cannot_read_foreign_entities(self):
        self.assertEqual([a["id"] for a in self.client.get("/api/accounts/").json()["items"]], [self.account.id])
        self.assertEqual(self.client.get("/api/transactions/").json()["items"], [])
        self.assertEqual(self.client.get("/api/obligations/").json()["items"], [])

    def test_cannot_write_foreign_entities(self):
        r = self.client.patch(f"/api/transactions/{self.other_tx.id}/", {"amount": 1}, content_type="application/json")
        self.assertEqual(r.status_code, 404)
        r = self.client.patch(f"/api/transactions/{self.other_tx.id}/", {"account_id": self.other_account.id},
                              content_type="application/json")
        self.assertEqual(r.status_code, 404)
        self.other_tx.refresh_from_db()
        self.assertEqual(self.other_tx.amount, 1000)

    def test_active_business_without_membership_is_rejected(self):
        # подменённый активный бизнес не даёт доступа: нужен Membership
        Profile.objects.filter(user=self.user).update(business=self.other_business)
        Membership.objects.filter(user=self.user).delete()
        self.assertEqual(self.client.get("/api/transactions/").status_code, 403)

    def test_stale_active_business_falls_back_to_membership(self):
        Profile.objects.filter(user=self.user).update(business=self.other_business)
        ids = [t["id"] for t in self.client.get("/api/transactions/").json()["items"]]
        self.assertNotIn(self.other_tx.id, ids)


class RoleMatrixTests(TestCase):
    def setUp(self):
        self.owner, self.business, self.account = make_user("own")
        self.accountant = add_member(self.business, "acc", "accountant")
        self.seller = add_member(self.business, "sel", "seller")
        self.owner_tx = Transaction.objects.create(
            business=self.business, account=self.account, date=D, amount=1000, direction="in", category="x",
            created_by=self.owner,
        )

    def as_(self, user):
        self.client.force_login(user)

    def test_seller_creates_and_sees_only_own(self):
        self.as_(self.seller)
        body = {"amount": 7000, "direction": "in", "category": "Розница", "account_id": self.account.id}
        r = jpost(self.client, "/api/transactions/", body)
        self.assertEqual(r.status_code, 201)
        items = self.client.get("/api/transactions/").json()["items"]
        self.assertEqual([t["id"] for t in items], [r.json()["id"]])
        self.assertEqual(self.client.delete(f"/api/transactions/{self.owner_tx.id}/").status_code, 404)
        accounts = self.client.get("/api/accounts/").json()["items"]
        self.assertNotIn("balance", accounts[0])

    def test_seller_forbidden_on_money_views(self):
        self.as_(self.seller)
        for url in ("/api/dashboard/pulse/", "/api/forecast/", "/api/obligations/", "/api/envelopes/",
                    "/api/analytics/summary/", "/api/insights/"):
            r = self.client.get(url)
            self.assertEqual(r.status_code, 403, url)
            self.assertEqual(r.json(), {"error": "forbidden"})

    def test_accountant_reads_all_writes_ops_but_not_settings(self):
        self.as_(self.accountant)
        self.assertEqual(self.client.get("/api/dashboard/pulse/").status_code, 200)
        self.assertEqual(len(self.client.get("/api/transactions/").json()["items"]), 1)
        r = jpost(self.client, "/api/obligations/", {"title": "Аренда", "kind": "rent", "amount": 10, "due_date": "2026-12-01"})
        self.assertEqual(r.status_code, 201)
        r = self.client.patch(f"/api/transactions/{self.owner_tx.id}/", {"amount": 5}, content_type="application/json")
        self.assertEqual(r.status_code, 200)
        r = self.client.patch("/api/business/", {"tax_regime": "turnover"}, content_type="application/json")
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.client.get(f"/api/businesses/{self.business.id}/members/").status_code, 403)

    def test_owner_everything(self):
        self.as_(self.owner)
        self.assertEqual(self.client.get("/api/forecast/").status_code, 200)
        r = self.client.patch("/api/business/", {"tax_regime": "turnover"}, content_type="application/json")
        self.assertEqual(r.status_code, 200)


CBU_JSON = [{"id": 69, "Code": "840", "Ccy": "USD", "Rate": "12010.45", "Nominal": "1", "Date": "17.11.2026"}]


class RatesTests(TestCase):
    def test_fetch_cbu_rate_parses_and_stores(self):
        resp = mock.Mock(status_code=200, json=lambda: CBU_JSON)
        resp.raise_for_status = lambda: None
        with mock.patch.object(rates.httpx, "get", return_value=resp) as get:
            row = rates.fetch_cbu_rate(date(2026, 11, 18))
        self.assertIn("/USD/2026-11-18/", get.call_args.args[0])
        self.assertEqual(row.date, date(2026, 11, 17))
        self.assertEqual(row.rate, Decimal("12010.45"))
        self.assertEqual(row.source, "cbu.uz")
        self.assertEqual(rates.get_rate("USD"), Decimal("12010.45"))

    def test_nominal_divides_rate(self):
        payload = [{**CBU_JSON[0], "Rate": "120104.5", "Nominal": "10"}]
        resp = mock.Mock(json=lambda: payload, raise_for_status=lambda: None)
        with mock.patch.object(rates.httpx, "get", return_value=resp):
            self.assertEqual(rates.fetch_cbu_rate(date(2026, 11, 18)).rate, Decimal("12010.45"))

    def test_to_uzs(self):
        ExchangeRate.objects.create(date=D, currency="USD", rate=Decimal("12010.45"), source="cbu.uz")
        self.assertEqual(rates.to_uzs(100_00, "USD"), 1_201_045)
        self.assertEqual(rates.to_uzs(5_000, "UZS"), 5_000)

    def test_fetch_rates_command(self):
        resp = mock.Mock(json=lambda: CBU_JSON, raise_for_status=lambda: None)
        with mock.patch.object(rates.httpx, "get", return_value=resp):
            call_command("fetch_rates")
        self.assertTrue(ExchangeRate.objects.filter(currency="USD").exists())

    def test_rates_endpoint(self):
        user, _, _ = make_user("r")
        self.client.force_login(user)
        ExchangeRate.objects.create(date=svc.today(), currency="USD", rate=Decimal("12010.45"), source="cbu.uz")
        self.assertEqual(self.client.get("/api/rates/").json(),
                         {"date": svc.today().isoformat(), "USD": "12010.45", "source": "cbu.uz", "stale": False})
        ExchangeRate.objects.all().update(date=svc.today() - timedelta(days=10))
        self.assertTrue(self.client.get("/api/rates/").json()["stale"])

    def test_rates_endpoint_unavailable(self):
        user, _, _ = make_user("r")
        self.client.force_login(user)
        with mock.patch.object(rates.httpx, "get", side_effect=rates.httpx.ConnectError("down")):
            r = self.client.get("/api/rates/")
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json(), {"error": "rates_unavailable"})

    def test_pulse_balance_in_uzs(self):
        user, business, cash = make_user("m")
        Account.objects.filter(pk=cash.pk).update(opening_balance=1_000_000)
        Account.objects.create(business=business, name="USD", kind="bank", currency="USD", opening_balance=100_00)
        ExchangeRate.objects.create(date=D, currency="USD", rate=Decimal("12000"), source="cbu.uz")
        self.assertEqual(svc.pulse(business)["balance"], 1_000_000 + 1_200_000)
        self.client.force_login(user)
        accounts = {a["name"]: a for a in self.client.get("/api/accounts/").json()["items"]}
        self.assertEqual(accounts["USD"]["balance"], 100_00)
        self.assertEqual(accounts["USD"]["currency"], "USD")
        self.assertEqual(accounts["USD"]["balance_uzs"], 1_200_000)
        self.assertEqual(self.client.get("/api/forecast/?days=1").json()["points"][0]["balance"], 2_200_000)

    def test_usd_revenue_converted_in_totals(self):
        _, business, _ = make_user("t")
        usd = Account.objects.create(business=business, name="USD", kind="bank", currency="USD")
        ExchangeRate.objects.create(date=D, currency="USD", rate=Decimal("12000"), source="cbu.uz")
        Transaction.objects.create(business=business, account=usd, date=D, amount=10_00, direction="in", category="x")
        self.assertEqual(svc.period_totals(business, D, D)["revenue"], 120_000)


class OwnerFlowsTests(TestCase):
    def setUp(self):
        self.user, self.business, self.cash = make_user("o")
        self.client.force_login(self.user)

    def add(self, amount, direction, purpose, category="x"):
        return jpost(self.client, "/api/transactions/", {
            "amount": amount, "direction": direction, "category": category, "purpose": purpose,
            "account_id": self.cash.id, "date": D.isoformat(),
        })

    def test_owner_draw_and_contribution_affect_cash_not_profit(self):
        self.assertEqual(self.add(1_000_000, "in", "business").status_code, 201)
        self.assertEqual(self.add(300_000, "out", "business").status_code, 201)
        self.assertEqual(self.add(200_000, "out", "owner_draw").status_code, 201)
        self.assertEqual(self.add(500_000, "in", "owner_contribution").status_code, 201)
        totals = svc.period_totals(self.business, D, D)
        self.assertEqual(totals["revenue"], 1_000_000)
        self.assertEqual(totals["expenses"], 300_000)
        self.assertEqual(totals["profit"], 700_000)
        self.assertEqual(totals["owner_draws"], 200_000)
        self.assertEqual(totals["owner_contributions"], 500_000)
        self.assertEqual(totals["cash_flow"], 1_000_000)
        self.assertEqual(svc.list_accounts(self.business)[0]["balance"], 1_000_000)

    def test_owner_kinds_require_matching_direction(self):
        self.assertEqual(self.add(1, "in", "owner_draw").status_code, 400)
        self.assertEqual(self.add(1, "out", "owner_contribution").status_code, 400)


class DemoSeedTenancyTests(TestCase):
    def test_demo_has_two_businesses_and_usd_account(self):
        user = seed_demo()
        memberships = Membership.objects.filter(user=user)
        self.assertEqual(memberships.count(), 2)
        self.assertTrue(all(m.role == "owner" for m in memberships))
        self.assertTrue(Account.objects.filter(business__in=[m.business for m in memberships], currency="USD").exists())
        self.client.force_login(user)
        self.assertEqual(self.client.get("/api/dashboard/pulse/").status_code, 200)
