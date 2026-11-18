from django.test import TestCase

from accounts.models import Business
from ai import people_tools
from finance.models import ExchangeRate
from finance.tests import add_member, jpost, make_user

from .models import Location, Person


class PeopleApiTests(TestCase):
    def setUp(self):
        self.owner, self.biz, _ = make_user("own")
        self.other, self.other_biz, _ = make_user("oth")
        self.seller = add_member(self.biz, "sel", "seller")
        self.client.force_login(self.owner)

    def patch(self, url, body):
        return self.client.patch(url, body, content_type="application/json")

    def test_crud_and_decimal_strings(self):
        loc = jpost(self.client, "/api/people/locations/", {"name": "Центр", "address": "ул. 1"})
        self.assertEqual(loc.status_code, 201)
        r = jpost(self.client, "/api/people/", {"name": "Али", "kind": "staff", "pay_type": "monthly",
                                                 "pay_amount": "3000000", "location_id": loc.json()["id"]})
        self.assertEqual(r.status_code, 201)
        p = r.json()
        self.assertEqual(p["pay_amount"], "3000000.00")
        self.assertEqual(p["currency"], "UZS")
        self.assertEqual(self.patch(f"/api/people/{p['id']}/", {"role_title": "Повар"}).json()["role_title"], "Повар")
        self.assertEqual(len(self.client.get("/api/people/").json()["people"]), 1)
        self.assertEqual(self.client.delete(f"/api/people/{p['id']}/").status_code, 204)
        self.assertEqual(self.patch(f"/api/people/locations/{loc.json()['id']}/", {"name": "Юг"}).json()["name"], "Юг")

    def test_validation(self):
        for bad in ({"name": ""}, {"name": "a", "kind": "x"}, {"name": "a", "pay_amount": "-1"},
                    {"name": "a", "currency": "GBP"}, {"name": "a", "started_on": "2025-02-01", "ended_on": "2025-01-01"},
                    {"name": "a", "location_id": 99999}):
            self.assertEqual(jpost(self.client, "/api/people/", bad).status_code in (400, 404), True, bad)

    def test_seller_forbidden(self):
        self.client.force_login(self.seller)
        for url in ("/api/people/", "/api/people/summary/", "/api/people/locations/"):
            self.assertEqual(self.client.get(url).status_code, 403)
        self.assertEqual(jpost(self.client, "/api/people/", {"name": "x"}).status_code, 403)

    def test_demo_write_forbidden(self):
        Business.objects.filter(pk=self.biz.pk).update(is_demo=True)
        r = jpost(self.client, "/api/people/", {"name": "x"})
        self.assertEqual((r.status_code, r.json()["error"]), (403, "demo_tenant"))
        self.assertEqual(self.client.get("/api/people/").status_code, 200)

    def test_cross_tenant_404(self):
        p = Person.objects.create(business=self.other_biz, name="z")
        loc = Location.objects.create(business=self.other_biz, name="z")
        self.assertEqual(self.patch(f"/api/people/{p.id}/", {"name": "y"}).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/people/{p.id}/").status_code, 404)
        self.assertEqual(self.patch(f"/api/people/locations/{loc.id}/", {"name": "y"}).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/people/locations/{loc.id}/").status_code, 404)
        r = jpost(self.client, "/api/people/", {"name": "a", "location_id": loc.id})
        self.assertEqual(r.status_code, 404)
        self.assertEqual(self.client.get("/api/people/").json()["people"], [])

    def test_summary_conversion(self):
        from django.utils import timezone

        ExchangeRate.objects.create(date=timezone.localdate(), currency="USD", rate="12000", source="cbu.uz")
        loc = Location.objects.create(business=self.biz, name="A")
        today = timezone.localdate()
        mk = lambda **kw: Person.objects.create(business=self.biz, pay_type="monthly", **kw)
        mk(name="a", pay_amount="1000000", location=loc, started_on=today)
        mk(name="b", pay_amount="100", currency="USD")
        mk(name="c", pay_amount="500", currency="EUR")
        mk(name="d", kind="partner", ended_on=today)
        s = self.client.get("/api/people/summary/").json()
        self.assertEqual(s["monthly_cost_uzs"], "2200000.00")
        self.assertEqual(s["unconverted"], ["EUR"])
        self.assertEqual(s["headcount_by_kind"]["staff"], 3)
        self.assertEqual(s["headcount_by_kind"]["partner"], 1)
        self.assertEqual(s["turnover_month"], {"joined": 1, "left": 1})
        self.assertEqual({r["location_id"]: r["headcount"] for r in s["by_location"]}, {loc.id: 1, None: 3})


class PeopleToolTests(TestCase):
    def test_add_never_creates_person(self):
        owner, biz, _ = make_user("own")
        r = people_tools.tool_add_person(biz, {"name": "Али", "pay_type": "monthly", "pay_amount": 5, "confirmed": True, "confirm_token": "x"}, owner, "owner")
        self.assertEqual(r["person_draft"]["name"], "Али")
        self.assertNotIn("ok", r)
        self.assertEqual(Person.objects.count(), 0)
        self.assertEqual(people_tools.tool_list_people(biz, {}, owner, "owner")["people"], [])
        self.assertEqual(people_tools.tool_add_person(biz, {"name": "x"}, owner, "seller")["error"], "forbidden")
        self.assertEqual(Person.objects.count(), 0)
