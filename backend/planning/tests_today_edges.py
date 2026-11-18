from datetime import date, timedelta
from unittest import mock

from finance import rates
from finance.models import Account, ExchangeRate, Obligation

from .models import TaxReserve
from .tests import PlanningCase, tx

URL = "/api/planning/today/"
# Среда: суббота +3, воскресенье +4, понедельник +5.
NOW = date(2026, 11, 18)


def at(days):
    return NOW + timedelta(days=days)


class TodayEdgeTests(PlanningCase):
    def setUp(self):
        super().setUp()
        patcher = mock.patch("finance.services.today", return_value=NOW)
        patcher.start()
        self.addCleanup(patcher.stop)

    def get(self, query=""):
        return self.client.get(URL + query)

    def obligation(self, title, kind, amount, days, status="planned"):
        return Obligation.objects.create(business=self.business, title=title, kind=kind, amount=amount,
                                         due_date=at(days), status=status)

    def reserve(self, **fields):
        fields.setdefault("enabled", True)
        return TaxReserve.objects.create(business=self.business, **fields)

    def assert_identity(self, body):
        t = body["totals"]
        self.assertEqual(body["balance"] + t["inflow"] + t["outflow"], t["end_balance"])
        self.assertEqual(sum(i["amount"] for i in body["items"] if i["amount"] > 0), t["inflow"])
        self.assertEqual(sum(i["amount"] for i in body["items"] if i["amount"] < 0), t["outflow"])

    # ---- пустой бизнес

    def test_empty_business_has_no_items_and_is_tight(self):
        body = self.get().json()
        self.assertEqual(body["balance"], 0)
        self.assertEqual(body["items"], [])
        self.assertEqual(body["totals"], {"inflow": 0, "outflow": 0, "end_balance": 0})
        self.assertEqual(body["can_take"], 0)
        self.assertEqual(body["tax_reserve"], 0)
        self.assertIsNone(body["gap"])
        self.assertEqual(body["verdict"], "tight")
        self.assertEqual(body["low"], {"date": at(1).isoformat(), "balance": 0})
        self.assertEqual(body["until"], at(2).isoformat())  # пятница
        self.assertEqual(body["until_reason"], "friday")

    def test_empty_business_with_explicit_until(self):
        body = self.get(f"?until={at(7).isoformat()}").json()
        self.assertEqual(body["until_reason"], "param")
        self.assertEqual(body["items"], [])
        self.assertEqual(body["verdict"], "tight")
        self.assertEqual(body["low"]["date"], at(1).isoformat())

    def test_only_spend_average_without_sales(self):
        self.fund(10_000_000)
        tx(self.business, self.account, 3_000_000, "out", at(-2), category="Прочее")
        body = self.get(f"?until={at(3).isoformat()}").json()
        kinds = [i["kind"] for i in body["items"]]
        self.assertEqual(kinds, ["daily_spend"])
        spend = body["items"][0]
        self.assertEqual(spend["per_day"], 100_000)
        self.assertEqual(spend["days"], 3)
        self.assertEqual(spend["amount"], -300_000)
        self.assertEqual(body["balance"], 7_000_000)
        self.assertEqual(body["totals"], {"inflow": 0, "outflow": -300_000, "end_balance": 6_700_000})
        self.assertEqual(body["low"], {"date": at(3).isoformat(), "balance": 6_700_000})
        self.assert_identity(body)

    def test_only_sales_average_without_spend(self):
        tx(self.business, self.account, 3_000_000, "in", at(-2))
        body = self.get(f"?until={at(3).isoformat()}").json()
        self.assertEqual([i["kind"] for i in body["items"]], ["daily_sales"])
        self.assertEqual(body["totals"]["inflow"], 300_000)
        self.assertEqual(body["totals"]["outflow"], 0)
        self.assertEqual(body["low"], {"date": at(1).isoformat(), "balance": 3_100_000})
        self.assert_identity(body)

    # ---- until на выходной

    def test_until_on_weekend_includes_weekend_payments_and_excludes_monday(self):
        self.fund(50_000_000)
        self.obligation("Суббота", "tax", 1_000_000, 3)
        self.obligation("Воскресенье", "rent", 2_000_000, 4)
        self.obligation("Понедельник", "supplier", 4_000_000, 5)
        body = self.get(f"?until={at(4).isoformat()}").json()
        self.assertEqual(body["until"], "2026-11-22")
        self.assertEqual(date.fromisoformat(body["until"]).weekday(), 6)
        self.assertEqual(body["until_reason"], "param")
        self.assertEqual({i["title"] for i in body["items"]}, {"Суббота", "Воскресенье"})
        self.assertEqual(body["totals"]["outflow"], -3_000_000)
        self.assertEqual(body["totals"]["end_balance"], 47_000_000)
        self.assertEqual(body["low"], {"date": "2026-11-22", "balance": 47_000_000})
        self.assert_identity(body)

    def test_default_until_may_be_weekend_salary_date(self):
        self.fund(50_000_000)
        self.obligation("Зарплата", "salary", 9_000_000, 3)  # суббота
        body = self.get().json()
        self.assertEqual(body["until"], "2026-11-21")
        self.assertEqual(body["until_reason"], "salary_rent")
        self.assertEqual([i["title"] for i in body["items"]], ["Зарплата"])
        self.assertEqual(body["totals"]["end_balance"], 41_000_000)
        self.assert_identity(body)

    def test_overdue_weekend_obligation_falls_on_tomorrow(self):
        self.fund(10_000_000)
        self.obligation("Просрочено", "supplier", 1_000_000, -9)
        body = self.get(f"?until={at(4).isoformat()}").json()
        self.assertEqual(body["items"][0]["date"], at(1).isoformat())
        self.assertEqual(body["totals"]["outflow"], -1_000_000)
        self.assert_identity(body)

    # ---- tax_reserve

    def test_fixed_reserve_reduces_can_take(self):
        self.fund(100_000_000)
        self.reserve(method="fixed", fixed_amount=30_000_000)
        body = self.get().json()
        self.assertEqual(body["tax_reserve"], 30_000_000)
        self.assertEqual(body["can_take"], 70_000_000)
        self.assertEqual(body["verdict"], "ok")
        self.assertEqual(body["balance"], 100_000_000)  # резерв не меняет остаток и итоги
        self.assertEqual(body["totals"]["end_balance"], 100_000_000)

    def test_reserve_applies_to_lowest_point_not_balance(self):
        self.fund(100_000_000)
        self.obligation("Платёж", "supplier", 60_000_000, 1)
        self.reserve(method="fixed", fixed_amount=10_000_000)
        body = self.get(f"?until={at(2).isoformat()}").json()
        self.assertEqual(body["low"]["balance"], 40_000_000)
        self.assertEqual(body["can_take"], 30_000_000)
        self.assertEqual(body["verdict"], "ok")
        self.assert_identity(body)

    def test_reserve_above_money_makes_it_tight_not_gap(self):
        self.fund(10_000_000)
        self.reserve(method="fixed", fixed_amount=25_000_000)
        body = self.get().json()
        self.assertEqual(body["tax_reserve"], 25_000_000)
        self.assertEqual(body["can_take"], 0)
        self.assertEqual(body["verdict"], "tight")
        self.assertIsNone(body["gap"])
        self.assertGreater(body["low"]["balance"], 0)

    def test_reserve_pushes_verdict_from_ok_to_tight(self):
        self.fund(100_000_000)
        self.obligation("Платёж", "supplier", 20_000_000, 1)
        until = f"?until={at(2).isoformat()}"
        self.assertEqual(self.get(until).json()["verdict"], "ok")  # 80M свободно
        self.reserve(method="fixed", fixed_amount=79_000_000)
        body = self.get(until).json()
        self.assertEqual(body["can_take"], 1_000_000)
        self.assertEqual(body["verdict"], "tight")  # 1M·10 < 20M

    def test_percent_reserve_uses_month_revenue(self):
        self.fund(1_000_000)
        tx(self.business, self.account, 10_000_000, "in", at(-1))
        self.reserve(method="percent", percent="10", period="month")
        body = self.get(f"?until={at(2).isoformat()}").json()
        self.assertEqual(body["tax_reserve"], 1_000_000)
        self.assertEqual(body["can_take"], body["low"]["balance"] - 1_000_000)

    def test_disabled_and_confirmed_reserve(self):
        self.fund(10_000_000)
        self.reserve(enabled=False, method="fixed", fixed_amount=5_000_000)
        self.assertEqual(self.get().json()["tax_reserve"], 0)
        TaxReserve.objects.filter(business=self.business).update(enabled=True, confirmed_amount=2_000_000)
        body = self.get().json()
        self.assertEqual(body["tax_reserve"], 2_000_000)
        self.assertEqual(body["can_take"], 8_000_000)

    # ---- нет курса

    def test_usd_balance_without_rate_is_503(self):
        Account.objects.create(business=self.business, name="USD", kind="bank", currency="USD",
                               opening_balance=100_00)
        with mock.patch.object(rates.httpx, "get", side_effect=rates.httpx.ConnectError("down")):
            r = self.get()
        self.assertEqual(r.status_code, 503)
        # Фактический код — rates_unavailable (finance/rates.py:25), документация обещает no_rate.
        self.assertEqual(r.json(), {"error": "rates_unavailable"})

    def test_usd_without_rate_is_503_with_explicit_until_too(self):
        Account.objects.create(business=self.business, name="USD", kind="bank", currency="USD",
                               opening_balance=100_00)
        with mock.patch.object(rates.httpx, "get", side_effect=rates.httpx.ConnectError("down")):
            self.assertEqual(self.get(f"?until={at(4).isoformat()}").status_code, 503)

    def test_empty_usd_account_needs_no_rate(self):
        Account.objects.create(business=self.business, name="USD", kind="bank", currency="USD")
        with mock.patch.object(rates.httpx, "get", side_effect=rates.httpx.ConnectError("down")):
            r = self.get()
        self.assertEqual(r.status_code, 200)

    def test_usd_balance_with_rate_is_converted(self):
        ExchangeRate.objects.create(date=NOW, currency="USD", rate="12000", source="cbu.uz")
        Account.objects.create(business=self.business, name="USD", kind="bank", currency="USD",
                               opening_balance=100_00)
        self.assertEqual(self.get().json()["balance"], 1_200_000)

    # ---- тождество с отрицательным оттоком

    def test_identity_with_negative_outflow_and_all_sources(self):
        self.fund(5_000_000)
        tx(self.business, self.account, 3_000_000, "in", at(-4))
        tx(self.business, self.account, 1_500_000, "out", at(-4), category="Прочее")
        self.obligation("Аренда", "rent", 7_000_000, 2)
        self.obligation("Дебитор", "receivable", 1_000_000, 3)
        body = self.get(f"?until={at(4).isoformat()}").json()
        t = body["totals"]
        self.assertLess(t["outflow"], 0)
        self.assertGreater(t["inflow"], 0)
        self.assertEqual(body["balance"] + t["inflow"] + t["outflow"], t["end_balance"])
        self.assert_identity(body)
        self.assertEqual(t["outflow"], -(7_000_000 + 50_000 * 4))
        self.assertEqual(t["inflow"], 1_000_000 + 100_000 * 4)

    def test_identity_when_balance_is_negative_throughout(self):
        self.fund(-2_000_000)
        self.obligation("Аренда", "rent", 1_000_000, 1)
        body = self.get(f"?until={at(2).isoformat()}").json()
        self.assertEqual(body["verdict"], "gap")
        self.assertEqual(body["can_take"], 0)
        self.assertEqual(body["gap"], {"date": at(1).isoformat(), "amount": 3_000_000})
        self.assertEqual(body["totals"]["end_balance"], -3_000_000)
        self.assert_identity(body)
