from datetime import timedelta

from django.test import TestCase, override_settings
from django.urls import include, path
from django.utils import timezone

from accounts.models import Business, Membership
from finance.models import Account, Obligation, Transaction
from finance.tests import make_user
from people.models import Person


def tx(biz, acc, amount, direction, days_ago=1, **kw):
    return Transaction.objects.create(
        business=biz, account=acc, amount=amount, direction=direction, category="x",
        date=timezone.localdate() - timedelta(days=days_ago), **kw,
    )


urlpatterns = [path("api/", include("rollup.urls"))]


@override_settings(ROOT_URLCONF="rollup.tests")
class RollupTests(TestCase):
    def setUp(self):
        self.user, self.biz, self.acc = make_user("own")
        self.other, self.other_biz, self.other_acc = make_user("stranger")
        self.client.force_login(self.user)

    def get(self):
        return self.client.get("/api/rollup/")

    def test_requires_login(self):
        self.client.logout()
        self.assertEqual(self.get().status_code, 401)

    def test_figures_and_totals(self):
        Account.objects.filter(pk=self.acc.pk).update(opening_balance=1000)
        tx(self.biz, self.acc, 500, "in")
        tx(self.biz, self.acc, 200, "out")
        tx(self.biz, self.acc, 900, "in", days_ago=45)  # вне окна, но в остатке
        tx(self.biz, self.acc, 300, "out", purpose="owner_draw")  # изъятие не расход бизнеса
        tx(self.biz, self.acc, 700, "in", status="draft")  # черновик не считается
        today = timezone.localdate()
        Obligation.objects.create(business=self.biz, title="a", kind="receivable", amount=400, due_date=today)
        Obligation.objects.create(business=self.biz, title="b", kind="rent", amount=250, due_date=today)
        Obligation.objects.create(business=self.biz, title="c", kind="rent", amount=999, due_date=today, status="paid")
        Person.objects.create(business=self.biz, name="a", kind="staff")
        Person.objects.create(business=self.biz, name="b", kind="contractor", ended_on=today - timedelta(days=1))
        Person.objects.create(business=self.biz, name="c", kind="buyer")
        second = Business.objects.create(name="Второй")
        Membership.objects.create(user=self.user, business=second, role="accountant")
        Account.objects.create(business=second, name="Касса", kind="cash", opening_balance=50)

        data = self.get().json()
        self.assertEqual(len(data["businesses"]), 2)
        row = next(b for b in data["businesses"] if b["id"] == self.biz.id)
        self.assertEqual(row["net_uzs"], 1000 + 500 - 200 + 900 - 300)
        self.assertEqual((row["inflow_30d_uzs"], row["outflow_30d_uzs"]), (500, 200))
        self.assertEqual((row["receivable_uzs"], row["payable_uzs"], row["headcount"]), (400, 250, 1))
        self.assertEqual(data["totals"]["net_uzs"], row["net_uzs"] + 50)
        self.assertEqual(data["totals"]["headcount"], 1)

    def test_excludes_seller_businesses(self):
        Membership.objects.create(user=self.user, business=self.other_biz, role="seller")
        ids = [b["id"] for b in self.get().json()["businesses"]]
        self.assertEqual(ids, [self.biz.id])

    def test_seller_only_user_gets_empty(self):
        Membership.objects.filter(user=self.user).update(role="seller")
        data = self.get().json()
        self.assertEqual(data["businesses"], [])
        self.assertEqual(data["totals"]["net_uzs"], 0)

    def test_cross_tenant_isolation(self):
        tx(self.other_biz, self.other_acc, 5000, "in")
        Obligation.objects.create(business=self.other_biz, title="z", kind="rent", amount=7, due_date=timezone.localdate())
        Person.objects.create(business=self.other_biz, name="x", kind="staff")
        data = self.get().json()
        self.assertEqual([b["id"] for b in data["businesses"]], [self.biz.id])
        self.assertEqual(data["totals"], {k: 0 for k in data["totals"]})
