from datetime import timedelta
from unittest import mock

from django.test import TestCase
from django.utils import timezone

from accounts.models import Membership
from finance import services as fin
from finance.models import Account, Envelope, ExchangeRate, Obligation, Order, Transaction
from finance.rates import RateUnavailable
from finance.tests import add_member, jpost, make_user

from . import services as svc
from .models import CashClose, Commitment, DebtorReminder, TaxReminder

TODAY = timezone.localdate()


def tx(business, account, amount, direction="in", day=None, **kw):
    kw.setdefault("category", "Розница")
    return Transaction.objects.create(
        business=business, account=account, amount=amount, direction=direction, date=day or TODAY, **kw
    )


class PlanningCase(TestCase):
    def setUp(self):
        self.user, self.business, self.account = make_user("own")
        Membership.objects.update_or_create(user=self.user, business=self.business, defaults={"role": "owner"})
        self.accountant = add_member(self.business, "acc", "accountant")
        self.seller = add_member(self.business, "sel", "seller")
        self.other_user, self.other_business, self.other_account = make_user("other")
        Membership.objects.update_or_create(user=self.other_user, business=self.other_business, defaults={"role": "owner"})
        self.client.force_login(self.user)

    def as_user(self, user):
        self.client.force_login(user)

    def fund(self, amount):
        Account.objects.filter(pk=self.account.pk).update(opening_balance=amount)

    def afford(self, **body):
        body.setdefault("currency", "UZS")
        return jpost(self.client, "/api/decisions/afford/", body)


class AffordTests(PlanningCase):
    def test_yes_and_nothing_is_written(self):
        self.fund(10_000_000)
        r = self.afford(amount=4_000_000)
        self.assertEqual(r.status_code, 200)
        body = r.json()
        self.assertEqual(body["verdict"], "yes")
        self.assertEqual(body["amount_uzs"], 4_000_000)
        self.assertEqual(body["min_balance_after"], 6_000_000)
        self.assertIsNone(body["gap_date"])
        self.assertTrue(body["explanation"])
        self.assertTrue(body["assumptions"])
        self.assertEqual(Transaction.objects.count(), 0)
        self.assertEqual(fin.balance_uzs(self.business), 10_000_000)

    def test_no_when_it_creates_gap_before_payment(self):
        self.fund(10_000_000)
        due = TODAY + timedelta(days=5)
        Obligation.objects.create(business=self.business, title="Аренда", kind="rent", amount=8_000_000, due_date=due)
        body = self.afford(amount=3_000_000).json()
        self.assertEqual(body["verdict"], "no")
        self.assertEqual(body["min_balance_after"], -1_000_000)
        self.assertEqual(body["gap_date"], due.isoformat())
        self.assertLessEqual(len(body["alternatives"]), 3)
        self.assertTrue(all(a["verdict"] in ("yes", "risky") for a in body["alternatives"]))

    def test_risky_below_envelope_and_tax_buffer(self):
        self.fund(10_000_000)
        Envelope.objects.create(business=self.business, title="Налоги", target=6_000_000, saved=5_000_000,
                                due_date=TODAY + timedelta(days=20))
        self.assertEqual(self.afford(amount=4_000_000).json()["verdict"], "yes")
        body = self.afford(amount=6_000_000).json()
        self.assertEqual(body["verdict"], "risky")
        self.assertEqual(body["min_balance_after"], 4_000_000)
        self.assertEqual([a["kind"] for a in body["alternatives"]][:1], ["smaller_amount"])

    def test_zero_balance(self):
        body = self.afford(amount=1000).json()
        self.assertEqual(body["verdict"], "no")
        self.assertEqual(body["min_balance_after"], -1000)

    def test_usd_amount_converted_at_latest_rate(self):
        ExchangeRate.objects.create(date=TODAY, currency="USD", rate="12000")
        self.fund(10_000_000)
        body = self.afford(amount=50_000, currency="USD").json()  # $500
        self.assertEqual(body["amount_uzs"], 6_000_000)
        self.assertEqual(body["verdict"], "yes")
        self.assertEqual(body["min_balance_after"], 4_000_000)

    def test_usd_account_balance_counts_in_uzs(self):
        ExchangeRate.objects.create(date=TODAY, currency="USD", rate="12000")
        Account.objects.create(business=self.business, name="USD", kind="bank", currency="USD", opening_balance=100_000)
        body = self.afford(amount=5_000_000).json()
        self.assertEqual(body["min_balance_after"], 7_000_000)

    def test_usd_without_rate_is_503_no_rate(self):
        with mock.patch("finance.rates.fetch_cbu_rate", side_effect=RateUnavailable("down")):
            r = self.afford(amount=100, currency="USD")
        self.assertEqual(r.status_code, 503)
        self.assertEqual(r.json(), {"error": "no_rate"})

    def test_recurring_outflow_accumulates(self):
        self.fund(10_000_000)
        self.assertEqual(self.afford(amount=3_000_000).json()["verdict"], "yes")
        body = self.afford(amount=3_000_000, recurring="weekly").json()
        self.assertEqual(body["verdict"], "no")  # 5 списаний за 30 дней
        self.assertEqual(body["min_balance_after"], 10_000_000 - 5 * 3_000_000)

    def test_future_date_and_limits(self):
        self.fund(10_000_000)
        later = (TODAY + timedelta(days=10)).isoformat()
        self.assertEqual(self.afford(amount=1000, date=later).json()["verdict"], "yes")
        self.assertEqual(self.afford(amount=1000, date=(TODAY + timedelta(days=91)).isoformat()).status_code, 400)

    def test_validation(self):
        for body in ({"amount": 0}, {"amount": 1.5}, {"amount": "5"}, {"amount": 5, "currency": "EUR"},
                     {"amount": 5, "recurring": "daily"}):
            self.assertEqual(self.afford(**body).status_code, 400, body)

    def test_roles_and_tenant(self):
        self.fund(1_000_000)
        Account.objects.filter(pk=self.other_account.pk).update(opening_balance=999_000_000)
        self.assertEqual(self.afford(amount=1_000_000).json()["verdict"], "yes")  # чужие деньги не видны
        self.as_user(self.accountant)
        self.assertEqual(self.afford(amount=1).status_code, 200)
        self.as_user(self.seller)
        self.assertEqual(self.afford(amount=1).status_code, 403)
        self.client.logout()
        self.assertEqual(self.afford(amount=1).status_code, 401)


class CashCloseTests(PlanningCase):
    def setUp(self):
        super().setUp()
        self.fund(100_000)
        tx(self.business, self.account, 50_000)
        tx(self.business, self.account, 20_000, "out", day=TODAY + timedelta(days=1))
        tx(self.business, self.account, 9_000, status="draft")

    def close(self, **body):
        body.setdefault("account_id", self.account.id)
        body.setdefault("counted", 140_000)
        return jpost(self.client, "/api/cash-close/", body)

    def test_expected_endpoint(self):
        r = self.client.get(f"/api/cash-close/expected/?account_id={self.account.id}")
        self.assertEqual(r.json(), {"account_id": self.account.id, "date": TODAY.isoformat(), "currency": "UZS",
                                    "expected": 150_000})
        tomorrow = (TODAY + timedelta(days=1)).isoformat()
        r = self.client.get(f"/api/cash-close/expected/?account_id={self.account.id}&date={tomorrow}")
        self.assertEqual(r.json()["expected"], 130_000)

    def test_expected_counts_transfers(self):
        other = Account.objects.create(business=self.business, name="Карта", kind="card", opening_balance=0)
        tx(self.business, self.account, 10_000, "transfer", transfer_account=other)
        self.account.refresh_from_db()
        self.assertEqual(svc.expected_balance(self.account, TODAY), 140_000)
        self.assertEqual(svc.expected_balance(other, TODAY), 10_000)

    def test_close_records_difference_and_history(self):
        r = self.close()
        self.assertEqual(r.status_code, 201)
        body = r.json()
        self.assertEqual((body["expected"], body["counted"], body["difference"]), (150_000, 140_000, -10_000))
        self.assertEqual(body["created_by"], self.user.id)
        self.assertEqual(svc.latest_cash_difference(self.business), -10_000)
        items = self.client.get("/api/cash-close/").json()["items"]
        self.assertEqual([i["id"] for i in items], [body["id"]])
        past = (TODAY - timedelta(days=3)).isoformat()
        self.close(date=past, counted=100_000)
        dates = [i["date"] for i in self.client.get("/api/cash-close/").json()["items"]]
        self.assertEqual(dates, [TODAY.isoformat(), past])
        self.assertEqual(len(self.client.get(f"/api/cash-close/?from={TODAY.isoformat()}").json()["items"]), 1)

    def test_second_close_for_same_day_is_409(self):
        self.close()
        r = self.close()
        self.assertEqual((r.status_code, r.json()), (409, {"error": "already_closed"}))

    def test_idempotency_key(self):
        headers = {"HTTP_IDEMPOTENCY_KEY": "k1"}
        first = self.client.post("/api/cash-close/", {"account_id": self.account.id, "counted": 150_000},
                                 content_type="application/json", **headers)
        again = self.client.post("/api/cash-close/", {"account_id": self.account.id, "counted": 150_000},
                                 content_type="application/json", **headers)
        self.assertEqual((first.status_code, again.status_code), (201, 200))
        self.assertEqual(first.json()["id"], again.json()["id"])
        clash = self.client.post("/api/cash-close/", {"account_id": self.account.id, "counted": 1},
                                 content_type="application/json", **headers)
        self.assertEqual((clash.status_code, clash.json()), (409, {"error": "idempotency_conflict"}))
        self.assertEqual(CashClose.objects.count(), 1)

    def test_patch_recomputes_difference(self):
        cid = self.close().json()["id"]
        r = self.client.patch(f"/api/cash-close/{cid}/", {"counted": 150_000, "note": "нашли чек"},
                              content_type="application/json")
        self.assertEqual((r.status_code, r.json()["difference"], r.json()["note"]), (200, 0, "нашли чек"))

    def test_validation(self):
        self.assertEqual(self.close(counted=-1).status_code, 400)
        self.assertEqual(self.close(counted=1.5).status_code, 400)
        self.assertEqual(self.close(date=(TODAY + timedelta(days=1)).isoformat()).status_code, 400)
        self.assertEqual(self.close(note="x" * 501).status_code, 400)

    def test_tenant_isolation(self):
        self.assertEqual(self.close(account_id=self.other_account.id).status_code, 404)
        foreign = CashClose.objects.create(
            business=self.other_business, account=self.other_account, date=TODAY, currency="UZS", expected=0,
            counted=0, difference=0, created_by=self.other_user)
        self.assertEqual(self.client.get("/api/cash-close/").json()["items"], [])
        self.assertEqual(self.client.patch(f"/api/cash-close/{foreign.id}/", {"counted": 5},
                                           content_type="application/json").status_code, 404)
        self.assertEqual(self.client.get(f"/api/cash-close/expected/?account_id={self.other_account.id}").status_code, 404)

    def test_seller_denied(self):
        self.as_user(self.seller)
        self.assertEqual(self.client.get("/api/cash-close/").status_code, 403)
        self.assertEqual(self.close().status_code, 403)
        self.assertEqual(self.client.get(f"/api/cash-close/expected/?account_id={self.account.id}").status_code, 403)


class PeriodReportTests(PlanningCase):
    def test_profit_vs_cash_vs_owner_money(self):
        tx(self.business, self.account, 1000)
        tx(self.business, self.account, 300, "out")
        tx(self.business, self.account, 200, "out", purpose="owner_draw")
        tx(self.business, self.account, 500, purpose="owner_contribution")
        tx(self.business, self.account, 99, purpose="unclear", direction="out")
        r = self.client.get(f"/api/reports/period/?from={TODAY.replace(day=1)}&to={TODAY}")
        b = r.json()
        self.assertEqual((b["revenue"], b["expenses"], b["profit"]), (1000, 399, 601))
        self.assertEqual((b["owner_draws"], b["owner_contributions"], b["cash_change"]), (200, 500, 901))
        self.assertEqual(b["currency"], "UZS")
        self.assertIn("unclear_purpose", b["missing_data"])

    def test_unexplained_cash_flagged_and_validation(self):
        CashClose.objects.create(business=self.business, account=self.account, date=TODAY, currency="UZS",
                                 expected=10, counted=5, difference=-5)
        self.assertIn("unexplained_cash", self.client.get("/api/reports/period/").json()["missing_data"])
        self.assertEqual(self.client.get(f"/api/reports/period/?from={TODAY}&to={TODAY - timedelta(days=1)}").status_code, 400)
        self.assertEqual(self.client.get("/api/reports/period/?from=nope").status_code, 400)

    def test_tenant_and_roles(self):
        tx(self.other_business, self.other_account, 777)
        self.assertEqual(self.client.get("/api/reports/period/").json()["revenue"], 0)
        self.as_user(self.accountant)
        self.assertEqual(self.client.get("/api/reports/period/").status_code, 200)
        self.as_user(self.seller)
        self.assertEqual(self.client.get("/api/reports/period/").status_code, 403)


class TaxReserveTests(PlanningCase):
    def put(self, **body):
        return self.client.put("/api/tax/reserve/", body, content_type="application/json")

    def test_default_is_disabled(self):
        b = self.client.get("/api/tax/reserve/").json()
        self.assertEqual((b["enabled"], b["reserved"], b["percent"]), (False, 0, None))
        self.assertIn("не налог", b["disclaimer"])
        self.assertEqual(svc.tax_reserve_amount(self.business), 0)

    def test_percent_uses_user_percent_on_base(self):
        tx(self.business, self.account, 1_000_000)
        tx(self.business, self.account, 500_000, purpose="owner_contribution")
        tx(self.business, self.account, 300_000, purpose="personal")
        tx(self.business, self.account, 200_000, category="Кредит")
        tx(self.other_business, self.other_account, 9_000_000)
        b = self.put(enabled=True, method="percent", percent="4.5", period="month").json()
        self.assertEqual((b["base_amount"], b["reserved"], b["percent"]), (1_000_000, 45_000, "4.50"))
        self.assertEqual(b["provenance"], "planning_estimate")
        self.assertEqual(svc.tax_reserve_amount(self.business), 45_000)

    def test_base_categories_fixed_and_confirmed(self):
        tx(self.business, self.account, 1_000_000)
        tx(self.business, self.account, 400_000, category="Заказы")
        b = self.put(enabled=True, method="percent", percent="10", period="quarter", base_categories=["Заказы"]).json()
        self.assertEqual((b["base_amount"], b["reserved"]), (400_000, 40_000))
        b = self.put(enabled=True, method="fixed", fixed_amount=250_000, period="month").json()
        self.assertEqual((b["reserved"], b["provenance"], b["percent"]), (250_000, "user_setting", None))
        b = self.put(enabled=True, method="fixed", fixed_amount=250_000, period="month", confirmed_amount=300_000).json()
        self.assertEqual((b["reserved"], b["provenance"]), (300_000, "accountant_confirmed"))
        b = self.put(enabled=False, method="fixed", fixed_amount=250_000, period="month").json()
        self.assertEqual(b["reserved"], 0)

    def test_validation_has_no_presets(self):
        for body in ({"enabled": True, "method": "percent", "period": "month"},
                     {"enabled": True, "method": "percent", "percent": "100", "period": "month"},
                     {"enabled": True, "method": "percent", "percent": 4, "period": "month"},
                     {"enabled": True, "method": "fixed", "fixed_amount": -1, "period": "month"},
                     {"enabled": True, "method": "usn", "period": "month"},
                     {"enabled": "yes", "method": "fixed", "fixed_amount": 1, "period": "month"}):
            self.assertEqual(self.put(**body).status_code, 400, body)

    def test_roles_and_tenant(self):
        self.put(enabled=True, method="fixed", fixed_amount=5, period="month")
        self.as_user(self.other_user)
        self.assertEqual(self.client.get("/api/tax/reserve/").json()["enabled"], False)
        self.as_user(self.seller)
        self.assertEqual(self.client.get("/api/tax/reserve/").status_code, 403)
        self.assertEqual(self.put(enabled=False, method="fixed", fixed_amount=1, period="month").status_code, 403)


class TaxReminderTests(PlanningCase):
    def post(self, **body):
        body.setdefault("title", "Отчёт")
        body.setdefault("kind", "report")
        body.setdefault("due_date", (TODAY + timedelta(days=10)).isoformat())
        return jpost(self.client, "/api/tax/reminders/", body)

    def test_requires_user_confirmation(self):
        self.assertEqual(self.post().status_code, 400)
        self.assertEqual(self.post(confirmed=False).status_code, 400)
        self.assertEqual(TaxReminder.objects.count(), 0)

    def test_create_report_reminder(self):
        r = self.post(confirmed=True, notify_telegram=True)
        self.assertEqual(r.status_code, 201)
        b = r.json()
        self.assertEqual((b["confirmed_by"], b["provenance"], b["obligation_id"], b["status"]),
                         (self.user.id, "user_setting", None, "planned"))
        self.assertTrue(b["notify_telegram"])

    def test_payment_with_amount_manages_tax_obligation(self):
        b = self.post(kind="payment", amount=500_000, confirmed=True).json()
        ob = Obligation.objects.get(pk=b["obligation_id"])
        self.assertEqual((ob.kind, ob.amount, ob.business_id, ob.status), ("tax", 500_000, self.business.id, "planned"))
        r = self.client.patch(f"/api/tax/reminders/{b['id']}/", {"status": "done", "amount": 600_000},
                              content_type="application/json")
        self.assertEqual(r.status_code, 200)
        ob.refresh_from_db()
        self.assertEqual((ob.status, ob.amount), ("paid", 600_000))
        self.assertEqual(self.client.delete(f"/api/tax/reminders/{b['id']}/").status_code, 204)
        self.assertFalse(Obligation.objects.filter(pk=ob.pk).exists())

    def test_moving_date_needs_new_confirmation(self):
        b = self.post(confirmed=True).json()
        new = (TODAY + timedelta(days=20)).isoformat()
        r = self.client.patch(f"/api/tax/reminders/{b['id']}/", {"due_date": new}, content_type="application/json")
        self.assertEqual(r.status_code, 400)
        r = self.client.patch(f"/api/tax/reminders/{b['id']}/", {"due_date": new, "confirmed": True},
                              content_type="application/json")
        self.assertEqual((r.status_code, r.json()["due_date"]), (200, new))
        self.assertEqual(len(self.client.get("/api/tax/reminders/").json()["items"]), 1)

    def test_accountant_confirmation_provenance_and_seller_denied(self):
        self.as_user(self.accountant)
        self.assertEqual(self.post(confirmed=True).json()["provenance"], "accountant_confirmed")
        self.as_user(self.seller)
        self.assertEqual(self.client.get("/api/tax/reminders/").status_code, 403)
        self.assertEqual(self.post(confirmed=True).status_code, 403)

    def test_tenant_isolation(self):
        foreign = TaxReminder.objects.create(
            business=self.other_business, title="x", kind="report", due_date=TODAY, confirmed_by=self.other_user,
            confirmed_at=timezone.now())
        self.assertEqual(self.client.get("/api/tax/reminders/").json()["items"], [])
        self.assertEqual(self.client.patch(f"/api/tax/reminders/{foreign.id}/", {"title": "y"},
                                           content_type="application/json").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/tax/reminders/{foreign.id}/").status_code, 404)
        self.assertTrue(TaxReminder.objects.filter(pk=foreign.pk).exists())


class GoalTests(PlanningCase):
    def create(self, **body):
        body.setdefault("kind", "savings")
        body.setdefault("title", "Подушка")
        body.setdefault("target", 1_000_000)
        return jpost(self.client, "/api/goals/", body)

    def test_crud_without_streaks(self):
        r = self.create()
        self.assertEqual(r.status_code, 201)
        b = r.json()
        self.assertEqual(set(b), {"id", "kind", "title", "target", "current", "due_date", "status"})
        r = self.client.patch(f"/api/goals/{b['id']}/", {"status": "archived", "target": 2_000_000},
                              content_type="application/json")
        self.assertEqual((r.json()["status"], r.json()["target"]), ("archived", 2_000_000))
        self.assertEqual(len(self.client.get("/api/goals/").json()["items"]), 1)
        self.assertEqual(self.client.delete(f"/api/goals/{b['id']}/").status_code, 204)
        self.assertEqual(self.client.get("/api/goals/").json()["items"], [])

    def test_progress_is_computed(self):
        self.fund(1_500_000)
        cushion = self.create(kind="safety_cushion", target=1_000_000).json()
        self.assertEqual((cushion["current"], cushion["status"]), (1_500_000, "achieved"))
        tx(self.business, self.account, 800_000)
        tx(self.business, self.account, 100_000, "out", purpose="personal")
        revenue = self.create(kind="revenue", target=2_000_000).json()
        leaks = self.create(kind="no_personal_leaks", target=50_000).json()
        self.assertEqual((revenue["current"], revenue["status"]), (800_000, "active"))
        self.assertEqual(leaks["current"], 100_000)

    def test_validation(self):
        for body in ({"kind": "streak"}, {"target": 0}, {"title": ""}, {"due_date": "bad"}):
            self.assertEqual(self.create(**body).status_code, 400, body)

    def test_roles_and_tenant(self):
        goal = self.create().json()
        self.as_user(self.accountant)
        self.assertEqual(self.client.get("/api/goals/").status_code, 200)
        self.assertEqual(self.create().status_code, 403)
        self.assertEqual(self.client.delete(f"/api/goals/{goal['id']}/").status_code, 403)
        self.as_user(self.seller)
        self.assertEqual(self.client.get("/api/goals/").status_code, 403)
        self.as_user(self.other_user)
        self.assertEqual(self.client.get("/api/goals/").json()["items"], [])
        self.assertEqual(self.client.delete(f"/api/goals/{goal['id']}/").status_code, 404)

    def test_benchmarks_coming_soon(self):
        self.assertEqual(self.client.get("/api/benchmarks/").json()["status"], "coming_soon")


class SeasonalityTests(PlanningCase):
    def test_insufficient_history(self):
        tx(self.business, self.account, 100, day=svc.add_months(TODAY.replace(day=1), -3))
        b = self.client.get("/api/seasonality/").json()
        self.assertEqual((b["status"], b["factors"]), ("insufficient_history", []))
        self.assertLess(b["months"], 12)

    def test_factors_from_own_history_only(self):
        this_month = TODAY.replace(day=1)
        for i in range(1, 13):
            tx(self.business, self.account, 300 if i == 3 else 100, day=svc.add_months(this_month, -i))
        tx(self.other_business, self.other_account, 10**9, day=svc.add_months(this_month, -5))
        b = self.client.get("/api/seasonality/").json()
        self.assertEqual(b["status"], "ok")
        factors = {f["month"]: f["factor"] for f in b["factors"]}
        self.assertEqual(factors[svc.add_months(this_month, -3).month], 2.57)
        self.assertEqual(factors[svc.add_months(this_month, -1).month], 0.86)

    def test_seller_denied(self):
        self.as_user(self.seller)
        self.assertEqual(self.client.get("/api/seasonality/").status_code, 403)


class DebtorTests(PlanningCase):
    def setUp(self):
        super().setUp()
        Order.objects.create(business=self.business, client="Али", channel="b2b", total=1000, prepaid=400,
                             status="production", due_date=TODAY - timedelta(days=5))
        Order.objects.create(business=self.business, client="Али", channel="b2b", total=500, prepaid=0,
                             status="delivered", due_date=TODAY + timedelta(days=5))
        Order.objects.create(business=self.business, client="Оплачен", channel="b2b", total=500, prepaid=0,
                             status="paid", due_date=TODAY)
        Obligation.objects.create(business=self.business, title="Бобур", kind="receivable", amount=300, due_date=TODAY)
        Order.objects.create(business=self.other_business, client="Чужой", channel="b2b", total=9, prepaid=0,
                             due_date=TODAY)

    def test_running_balance_per_counterparty(self):
        items = self.client.get("/api/debtors/").json()["items"]
        self.assertEqual([i["counterparty"] for i in items], ["Али", "Бобур"])
        ali = items[0]
        self.assertEqual((ali["balance"], ali["overdue_days"]), (1100, 5))
        self.assertEqual([e["running_balance"] for e in ali["entries"]], [600, 1100])

    def test_reminder_is_draft_until_owner_approves(self):
        r = jpost(self.client, "/api/debtors/reminders/", {"counterparty": "Али"})
        self.assertEqual(r.status_code, 201)
        b = r.json()
        self.assertEqual((b["status"], b["approved_by"], b["amount"]), ("draft", None, 1100))
        self.assertIn("Али", b["text"])
        self.as_user(self.accountant)
        r = self.client.patch(f"/api/debtors/reminders/{b['id']}/", {"status": "approved"}, content_type="application/json")
        self.assertEqual(r.status_code, 403)
        self.as_user(self.user)
        r = self.client.patch(f"/api/debtors/reminders/{b['id']}/", {"status": "approved"}, content_type="application/json")
        self.assertEqual((r.json()["status"], r.json()["approved_by"]), ("approved", self.user.id))
        r = self.client.patch(f"/api/debtors/reminders/{b['id']}/", {"text": "Новый текст"}, content_type="application/json")
        self.assertEqual((r.json()["status"], r.json()["text"]), ("draft", "Новый текст"))

    def test_unknown_or_foreign_debtor_404_and_seller_denied(self):
        self.assertEqual(jpost(self.client, "/api/debtors/reminders/", {"counterparty": "Чужой"}).status_code, 404)
        self.assertEqual(DebtorReminder.objects.count(), 0)
        self.as_user(self.seller)
        self.assertEqual(self.client.get("/api/debtors/").status_code, 403)
        self.assertEqual(jpost(self.client, "/api/debtors/reminders/", {"counterparty": "Али"}).status_code, 403)


class CommitmentTests(PlanningCase):
    def create(self, **body):
        body.setdefault("title", "Аренда")
        body.setdefault("category", "Аренда")
        body.setdefault("amount", 2_000_000)
        body.setdefault("frequency", "monthly")
        body.setdefault("next_date", TODAY.isoformat())
        body.setdefault("account_id", self.account.id)
        return jpost(self.client, "/api/commitments/", body)

    def test_nothing_is_booked_until_confirmed(self):
        c = self.create().json()
        self.assertTrue(c["due"])
        self.assertEqual(Transaction.objects.count(), 0)
        r = self.client.post(f"/api/commitments/{c['id']}/confirm/")
        self.assertEqual(r.status_code, 201)
        op = r.json()["operation"]
        self.assertEqual((op["status"], op["direction"], op["amount"], op["date"]), ("draft", "out", 2_000_000, TODAY.isoformat()))
        self.assertEqual(r.json()["commitment"]["next_date"], svc.add_months(TODAY, 1).isoformat())
        self.assertEqual(fin.balance_uzs(self.business), 0)  # черновик не двигает остаток
        self.assertEqual(Transaction.objects.filter(status="draft").count(), 1)

    def test_weekly_and_inactive(self):
        c = self.create(frequency="weekly").json()
        r = self.client.post(f"/api/commitments/{c['id']}/confirm/").json()
        self.assertEqual(r["commitment"]["next_date"], (TODAY + timedelta(days=7)).isoformat())
        self.client.patch(f"/api/commitments/{c['id']}/", {"active": False}, content_type="application/json")
        self.assertEqual(self.client.post(f"/api/commitments/{c['id']}/confirm/").status_code, 409)

    def test_month_end_is_clamped(self):
        from datetime import date
        self.assertEqual(svc.add_months(date(2026, 1, 31), 1), date(2026, 2, 28))

    def test_validation_tenant_roles(self):
        self.assertEqual(self.create(amount=0).status_code, 400)
        self.assertEqual(self.create(frequency="daily").status_code, 400)
        self.assertEqual(self.create(account_id=self.other_account.id).status_code, 400)
        foreign = Commitment.objects.create(business=self.other_business, account=self.other_account, title="x",
                                            category="x", amount=1, frequency="weekly", next_date=TODAY)
        self.assertEqual(self.client.post(f"/api/commitments/{foreign.id}/confirm/").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/commitments/{foreign.id}/").status_code, 404)
        self.assertEqual(self.client.get("/api/commitments/").json()["items"], [])
        self.as_user(self.seller)
        self.assertEqual(self.client.get("/api/commitments/").status_code, 403)
        self.assertEqual(self.create().status_code, 403)
