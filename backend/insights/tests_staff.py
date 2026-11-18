from datetime import date, timedelta

from django.test import TestCase

from accounts.models import Business
from finance.models import Account, Transaction
from insights.staff import staff_insights
from people.models import Person

NOW = date(2026, 6, 30)


def setup(revenue_by_window, staff=(), opening=50_000_000):
    business = Business.objects.create(name="b")
    account = Account.objects.create(business=business, name="Касса", kind="cash", opening_balance=opening)
    for i, rev in enumerate(revenue_by_window):  # i=0 — последние 30 дней
        if rev:
            Transaction.objects.create(business=business, account=account, date=NOW - timedelta(days=WINDOW_MID * i + 5),
                                       amount=rev, direction="in", category="Продажи")
    for name, pay in staff:
        Person.objects.create(business=business, name=name, kind="staff", pay_type="monthly", pay_amount=pay,
                              started_on=date(2025, 1, 1))
    return business


WINDOW_MID = 30


def by_id(items):
    return {i["id"]: i for i in items}


class StaffInsightsTests(TestCase):
    def test_nothing_without_staff_or_revenue(self):
        self.assertEqual(staff_insights(setup([10_000_000]), NOW), [])
        self.assertEqual(staff_insights(setup([0], [("A", 3_000_000)]), NOW), [])

    def test_share_and_per_head_numbers(self):
        b = setup([20_000_000], [("A", 3_000_000), ("B", 3_000_000)])
        items = by_id(staff_insights(b, NOW))
        self.assertEqual(items["staff-payroll-share"]["title"], "На зарплаты уходит 30% выручки")
        self.assertIn("6 млн ÷ 20 млн = 30%", items["staff-payroll-share"]["body"])
        self.assertIn("10 млн", items["staff-revenue-per-head"]["title"])
        self.assertEqual(items["staff-payroll-share"]["tone"], "calm")

    def test_headroom_yes_when_cash_is_ample(self):
        b = setup([20_000_000], [("A", 3_000_000)])
        card = by_id(staff_insights(b, NOW))["staff-hire-headroom"]
        self.assertEqual(card["tone"], "calm")
        self.assertIn("3 млн", card["title"])

    def test_payroll_over_safe_share_is_risk(self):
        b = setup([10_000_000], [("A", 6_000_000)])
        items = by_id(staff_insights(b, NOW))
        self.assertEqual(items["staff-payroll-share"]["tone"], "risk")
        self.assertEqual(items["staff-hire-headroom"]["tone"], "risk")

    def test_trend_down_when_revenue_flat_and_staff_grows(self):
        b = setup([10_000_000, 10_000_000, 10_000_000], [("A", 1_000_000)])
        Person.objects.create(business=b, name="B", kind="staff", pay_type="monthly", pay_amount=1_000_000,
                              started_on=NOW - timedelta(days=40))
        trend = by_id(staff_insights(b, NOW))["staff-load-trend"]
        self.assertIn("упала на 50%", trend["title"])
        self.assertIn("10 млн → 5 млн → 5 млн", trend["body"])

    def test_no_trend_when_window_has_no_revenue(self):
        b = setup([10_000_000, 10_000_000], [("A", 1_000_000)])
        self.assertNotIn("staff-load-trend", by_id(staff_insights(b, NOW)))

    def test_non_monthly_and_ended_staff_ignored(self):
        b = setup([10_000_000], [("A", 1_000_000)])
        Person.objects.create(business=b, name="H", kind="staff", pay_type="hourly", pay_amount=50_000)
        Person.objects.create(business=b, name="Old", kind="staff", pay_type="monthly", pay_amount=9_000_000,
                              ended_on=NOW - timedelta(days=1))
        body = by_id(staff_insights(b, NOW))["staff-payroll-share"]["body"]
        self.assertIn("1 млн ÷ 10 млн = 10%", body)
