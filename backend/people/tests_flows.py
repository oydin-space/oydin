from datetime import timedelta

from django.utils import timezone

from finance.models import ExchangeRate, Obligation
from finance.tests import jpost
from planning.tests import PlanningCase

from .models import Location, Person


class PeoplePayrollFlowTests(PlanningCase):
    def setUp(self):
        super().setUp()
        self.today = timezone.localdate()
        self.fund(50_000_000)

    def patch(self, url, body):
        return self.client.patch(url, body, content_type="application/json")

    def summary(self):
        return self.client.get("/api/people/summary/").json()

    def split(self):
        return self.client.get("/api/planning/split/").json()

    def hire(self, **kw):
        body = {"name": "Али", "kind": "staff", "pay_type": "monthly", "pay_amount": "3000000"}
        body.update(kw)
        r = jpost(self.client, "/api/people/", body)
        self.assertEqual(r.status_code, 201, r.content)
        return r.json()

    def test_create_edit_delete_feed_summary_and_split(self):
        base = self.split()
        self.assertEqual((base["afloat"]["payroll"], base["net"]), (0, 50_000_000))
        self.assertEqual(self.summary()["monthly_cost_uzs"], "0.00")

        p = self.hire()
        self.assertEqual(self.summary()["monthly_cost_uzs"], "3000000.00")
        s = self.split()
        self.assertEqual((s["afloat"]["payroll"], s["afloat"]["needed"]), (3_000_000, 3_000_000))
        self.assertEqual(s["afloat"]["amount"] + s["development"]["amount"] + s["owner"]["amount"], s["net"])
        self.assertEqual(s["development"]["amount"] + s["owner"]["amount"], 47_000_000)

        # edit pay
        self.assertEqual(self.patch(f"/api/people/{p['id']}/", {"pay_amount": "4500000"}).status_code, 200)
        self.assertEqual(self.summary()["monthly_cost_uzs"], "4500000.00")
        s = self.split()
        self.assertEqual(s["afloat"]["payroll"], 4_500_000)
        self.assertEqual(s["development"]["amount"] + s["owner"]["amount"], 45_500_000)

        # second person adds up
        q = self.hire(name="Бек", pay_amount="1000000")
        self.assertEqual(self.split()["afloat"]["payroll"], 5_500_000)

        # delete returns payroll
        self.assertEqual(self.client.delete(f"/api/people/{q['id']}/").status_code, 204)
        self.assertEqual(self.split()["afloat"]["payroll"], 4_500_000)
        self.assertEqual(self.client.delete(f"/api/people/{p['id']}/").status_code, 204)
        s = self.split()
        self.assertEqual((s["afloat"]["payroll"], s["afloat"]["needed"]), (0, 0))
        self.assertEqual(self.client.delete(f"/api/people/{p['id']}/").status_code, 404)

    def test_deactivate_by_end_date_and_future_start(self):
        p = self.hire()
        yesterday = (self.today - timedelta(days=1)).isoformat()
        # ended_on inclusive: today still counts
        self.patch(f"/api/people/{p['id']}/", {"ended_on": self.today.isoformat()})
        self.assertEqual(self.split()["afloat"]["payroll"], 3_000_000)
        self.patch(f"/api/people/{p['id']}/", {"ended_on": yesterday})
        self.assertEqual(self.summary()["monthly_cost_uzs"], "0.00")
        self.assertEqual(self.summary()["headcount_by_kind"]["staff"], 0)
        self.assertEqual(self.split()["afloat"]["payroll"], 0)
        # reactivate
        self.patch(f"/api/people/{p['id']}/", {"ended_on": None})
        self.assertEqual(self.split()["afloat"]["payroll"], 3_000_000)
        # not yet started: not counted
        self.patch(f"/api/people/{p['id']}/", {"started_on": (self.today + timedelta(days=3)).isoformat()})
        self.assertEqual(self.split()["afloat"]["payroll"], 0)
        # still listed
        self.assertEqual(len(self.client.get("/api/people/").json()["people"]), 1)

    def test_patch_cannot_make_dates_inverted(self):
        p = self.hire(started_on="2025-03-01")
        r = self.patch(f"/api/people/{p['id']}/", {"ended_on": "2025-02-01"})
        self.assertEqual(r.status_code, 400)
        self.assertIsNone(Person.objects.get(pk=p["id"]).ended_on)

    def test_only_monthly_counts_toward_payroll(self):
        self.hire(pay_type="per_task", kind="contractor", name="Под")
        self.hire(pay_type="hourly", name="Час")
        self.hire(pay_type="percent", name="Про")
        self.hire(pay_amount=None, name="Без")
        self.assertEqual(self.split()["afloat"]["payroll"], 0)

    def test_usd_pay_converted_and_rub_makes_shares_null(self):
        ExchangeRate.objects.create(date=self.today, currency="USD", rate="12000", source="cbu.uz")
        self.hire(currency="USD", pay_amount="100")
        self.assertEqual(self.split()["afloat"]["payroll"], 1_200_000)
        r = self.hire(currency="RUB", pay_amount="1000", name="Рубль")
        s = self.split()
        self.assertEqual(s["afloat"]["payroll_unconverted"], ["RUB"])
        self.assertIsNone(s["owner"]["amount"])
        self.client.delete(f"/api/people/{r['id']}/")
        s = self.split()
        self.assertEqual(s["afloat"]["payroll_unconverted"], [])
        self.assertIsNotNone(s["owner"]["amount"])

    def test_payroll_replaces_salary_obligation_and_returns_it_after_delete(self):
        Obligation.objects.create(business=self.business, title="ЗП", kind="salary", amount=2_000_000,
                                  due_date=self.today + timedelta(days=3))
        self.assertEqual(self.split()["afloat"]["needed"], 2_000_000)
        p = self.hire(pay_amount="3000000")
        self.assertEqual(self.split()["afloat"]["needed"], 3_000_000)
        self.client.delete(f"/api/people/{p['id']}/")
        self.assertEqual(self.split()["afloat"]["needed"], 2_000_000)

    def test_roles(self):
        # current rule: FINANCE_READERS (owner + accountant) may read AND write people; seller nothing
        self.as_user(self.accountant)
        p = self.hire()
        self.assertEqual(self.patch(f"/api/people/{p['id']}/", {"pay_amount": "1"}).status_code, 200)
        self.assertEqual(self.summary()["monthly_cost_uzs"], "1.00")
        self.assertEqual(self.client.delete(f"/api/people/{p['id']}/").status_code, 204)

        keep = Person.objects.create(business=self.business, name="k", pay_type="monthly", pay_amount=100)
        self.as_user(self.seller)
        self.assertEqual(self.client.get("/api/people/").status_code, 403)
        self.assertEqual(jpost(self.client, "/api/people/", {"name": "x"}).status_code, 403)
        self.assertEqual(self.patch(f"/api/people/{keep.id}/", {"name": "y"}).status_code, 403)
        self.assertEqual(self.client.delete(f"/api/people/{keep.id}/").status_code, 403)
        self.assertEqual(self.client.get("/api/planning/split/").status_code, 403)
        self.assertTrue(Person.objects.filter(pk=keep.id, name="k").exists())

    def test_tenant_isolation_in_payroll(self):
        Person.objects.create(business=self.other_business, name="z", pay_type="monthly", pay_amount=9_000_000)
        self.assertEqual(self.split()["afloat"]["payroll"], 0)
        self.assertEqual(self.summary()["monthly_cost_uzs"], "0.00")

    def test_location_delete_keeps_person(self):
        loc = Location.objects.create(business=self.business, name="A")
        p = self.hire(location_id=loc.id)
        self.assertEqual(self.client.delete(f"/api/people/locations/{loc.id}/").status_code, 204)
        self.assertEqual(self.split()["afloat"]["payroll"], 3_000_000)
        self.assertIsNone(Person.objects.get(pk=p["id"]).location_id)
