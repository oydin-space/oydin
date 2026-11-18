from datetime import date, timedelta

from django.core.cache import cache
from django.test import Client, TestCase, override_settings

from finance import services as svc
from finance.domain import forecast as fc
from finance.domain import pulse as pl
from finance.models import Obligation, Transaction
from finance.tests_features import make, urlpatterns  # noqa: F401 — ROOT_URLCONF этого модуля


@override_settings(ROOT_URLCONF=__name__)
class PeriodTests(TestCase):
    def setUp(self):
        cache.clear()
        self.user, self.business, self.cash = make()
        self.client = Client()
        self.client.force_login(self.user)
        self.today = svc.today()

    def tx(self, days_ago, amount, direction="in"):
        return Transaction.objects.create(
            business=self.business, account=self.cash, date=self.today - timedelta(days=days_ago), amount=amount,
            direction=direction, category="Розница", created_by=self.user,
        )

    def test_transactions_from_to(self):
        self.tx(40, 1)
        mid = self.tx(10, 2)
        self.tx(0, 3)
        start, end = (self.today - timedelta(days=20)).isoformat(), (self.today - timedelta(days=5)).isoformat()
        r = self.client.get(f"/api/transactions/?from={start}&to={end}")
        self.assertEqual(r.status_code, 200)
        self.assertEqual([t["id"] for t in r.json()["items"]], [mid.id])
        only_from = self.client.get(f"/api/transactions/?from={start}").json()["items"]
        self.assertEqual(len(only_from), 2)

    def test_invalid_dates(self):
        for qs in ("from=nope", "to=2026-13-01", f"from={self.today}&to={self.today - timedelta(days=1)}"):
            for url in ("/api/transactions/", "/api/dashboard/pulse/"):
                r = self.client.get(f"{url}?{qs}")
                self.assertEqual((r.status_code, r.json()["error"]), (400, "invalid_date"), (url, qs))

    def test_pulse_revenue_week_and_period(self):
        self.tx(1, 700)
        self.tx(9, 500)
        self.tx(9, 999, direction="out")
        week = self.client.get("/api/dashboard/pulse/").json()["revenue_week"]
        self.assertEqual(week, {"amount": 700, "prev_amount": 500, "delta_pct": 40})
        self.tx(40, 10_000)
        start, end = self.today - timedelta(days=45), self.today - timedelta(days=35)
        r = self.client.get(f"/api/dashboard/pulse/?from={start}&to={end}").json()
        self.assertEqual(r["period"], {"from": start.isoformat(), "to": end.isoformat()})
        self.assertEqual(r["revenue_week"]["amount"], 10_000)
        profit = next(m for m in r["metrics"] if m["key"] == "profit")
        self.assertEqual(profit["value"], 10_000)

    def test_revenue_week_without_previous(self):
        self.tx(0, 100)
        self.assertEqual(svc.pulse(self.business)["revenue_week"]["delta_pct"], None)

    def test_safe_reason_when_reserved_for_gap(self):
        self.tx(0, 1_000_000)
        Obligation.objects.create(business=self.business, title="Аренда", kind="payable", amount=3_000_000,
                                  due_date=self.today + timedelta(days=5))
        p = svc.pulse(self.business)
        self.assertEqual(p["safe_to_spend"], 0)
        self.assertEqual(p["safe_reason"], "gap")
        self.assertEqual(p["reserved_upcoming"], 1_000_000)
        # runway совпадает с датой разрыва
        self.assertEqual(p["runway_days"], (date.fromisoformat(p["gap"]["date"]) - self.today).days)

    def test_runway_matches_first_negative_point(self):
        today = self.today
        points = fc.build_forecast(today, 1000, [fc.Flow(today + timedelta(days=7), -5000, "x")], 0, 10, 30)
        self.assertEqual(pl.runway_days(today, 1000, points, 10), 7)
        calm = fc.build_forecast(today, 1000, [], 0, 0, 30)
        self.assertEqual(pl.runway_days(today, 1000, calm, 0), 365)


class PulseFutureStartTests(TestCase):
    def test_period_from_not_after_to(self):
        user, business, _ = make()
        today = svc.today()
        period = svc.pulse(business, start=today + timedelta(days=5), end=today + timedelta(days=9))["period"]
        self.assertLessEqual(period["from"], period["to"])
