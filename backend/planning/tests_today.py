from datetime import date, timedelta
from unittest import mock

from finance.models import Obligation, Order

from .tests import TODAY, PlanningCase, tx

URL = "/api/planning/today/"


def obligation(business, title, kind, amount, days, status="planned"):
    return Obligation.objects.create(business=business, title=title, kind=kind, amount=amount,
                                     due_date=TODAY + timedelta(days=days), status=status)


class TodayTests(PlanningCase):
    def get(self, query=""):
        return self.client.get(URL + query)

    def assert_identity(self, body):
        t = body["totals"]
        self.assertEqual(body["balance"] + t["inflow"] + t["outflow"], t["end_balance"])
        self.assertEqual(sum(i["amount"] for i in body["items"] if i["amount"] > 0), t["inflow"])
        self.assertEqual(sum(i["amount"] for i in body["items"] if i["amount"] < 0), t["outflow"])

    def test_default_until_is_nearest_salary_or_rent(self):
        self.fund(50_000_000)
        obligation(self.business, "Налог", "tax", 1_000_000, 1)
        obligation(self.business, "Оплачено", "rent", 1_000_000, 2, status="paid")
        obligation(self.business, "Аренда", "rent", 5_000_000, 4)
        obligation(self.business, "Зарплата", "salary", 9_000_000, 9)
        body = self.get().json()
        self.assertEqual(body["until"], (TODAY + timedelta(days=4)).isoformat())
        self.assertEqual(body["until_reason"], "salary_rent")
        self.assertEqual(body["as_of"], TODAY.isoformat())
        self.assertEqual({i["kind"] for i in body["items"]}, {"tax", "rent"})
        self.assert_identity(body)

    def test_friday_fallback(self):
        for today, expected in ((date(2026, 11, 18), date(2026, 11, 20)), (date(2026, 11, 20), date(2026, 11, 27))):
            with mock.patch("finance.services.today", return_value=today):
                body = self.get().json()
            self.assertEqual(body["until"], expected.isoformat())
            self.assertEqual(body["until_reason"], "friday")

    def test_param_validation(self):
        for value in ("garbage", TODAY.isoformat(), (TODAY - timedelta(days=1)).isoformat(),
                      (TODAY + timedelta(days=91)).isoformat()):
            r = self.get(f"?until={value}")
            self.assertEqual((r.status_code, r.json()["error"]), (400, "invalid_until"), value)
        ok = self.get(f"?until={(TODAY + timedelta(days=90)).isoformat()}")
        self.assertEqual(ok.status_code, 200)
        self.assertEqual(ok.json()["until_reason"], "param")

    def test_gap_with_breakdown_and_averages(self):
        self.fund(10_000_000)
        tx(self.business, self.account, 3_000_000, "in", TODAY - timedelta(days=5))
        tx(self.business, self.account, 600_000, "out", TODAY - timedelta(days=5), category="Прочее")
        rent = obligation(self.business, "Зарплата сотрудникам", "salary", 20_000_000, 3)
        order = Order.objects.create(business=self.business, client="ООО Артель", channel="b2b", total=4_000_000,
                                     prepaid=0, status="delivered", due_date=TODAY + timedelta(days=2))
        body = self.get(f"?until={(TODAY + timedelta(days=3)).isoformat()}&lang=en").json()
        balance = 13_000_000 - 0  # 10M opening + 3M in - 0.6M out
        balance = 10_000_000 + 3_000_000 - 600_000
        self.assertEqual(body["balance"], balance)
        by_kind = {i["kind"]: i for i in body["items"]}
        self.assertEqual(by_kind["salary"]["ref_id"], rent.id)
        self.assertEqual(by_kind["salary"]["amount"], -20_000_000)
        self.assertEqual(by_kind["receivable"]["ref_id"], order.id)
        self.assertEqual(by_kind["receivable"]["source"], "order")
        self.assertEqual(by_kind["daily_sales"]["days"], 3)
        self.assertEqual(by_kind["daily_sales"]["per_day"], 100_000)
        self.assertEqual(by_kind["daily_sales"]["title"], "Average sales (30 days) × 3 d.")
        self.assertEqual(by_kind["daily_spend"]["per_day"], 20_000)
        self.assertEqual(body["items"][-1]["date"], None)
        self.assert_identity(body)
        end = body["totals"]["end_balance"]
        self.assertLess(end, 0)
        self.assertEqual(body["verdict"], "gap")
        self.assertEqual(body["gap"], {"date": (TODAY + timedelta(days=3)).isoformat(), "amount": -end})
        self.assertEqual(body["low"], {"date": body["gap"]["date"], "balance": end})
        self.assertEqual(body["can_take"], 0)

    def test_ok_when_money_is_enough(self):
        self.fund(100_000_000)
        obligation(self.business, "Аренда", "rent", 5_000_000, 3)
        body = self.get().json()
        self.assertEqual(body["verdict"], "ok")
        self.assertIsNone(body["gap"])
        self.assertEqual(body["can_take"], 95_000_000 - body["tax_reserve"])
        self.assert_identity(body)

    def test_tight_when_nothing_spare(self):
        self.fund(5_000_000)
        obligation(self.business, "Аренда", "rent", 5_000_000, 3)
        body = self.get().json()
        self.assertEqual(body["verdict"], "tight")
        self.assertEqual(body["can_take"], 0)
        self.assertIsNone(body["gap"])

    def test_accountant_reads_seller_and_anonymous_do_not(self):
        self.as_user(self.accountant)
        self.assertEqual(self.get().status_code, 200)
        self.as_user(self.seller)
        self.assertEqual(self.get().status_code, 403)
        self.client.logout()
        self.assertEqual(self.get().status_code, 401)

    def test_other_business_is_isolated(self):
        self.fund(10_000_000)
        obligation(self.other_business, "Чужая аренда", "rent", 7_000_000, 2)
        body = self.get().json()
        self.assertEqual(body["items"], [])
        self.assertEqual(body["until_reason"], "friday")
        self.assertEqual(body["balance"], 10_000_000)
