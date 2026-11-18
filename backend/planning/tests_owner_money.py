import json
from datetime import timedelta
from decimal import Decimal

from finance.models import Obligation
from people.models import Person

from . import owner_money
from .models import Commitment, OwnerSplit
from .tests import PlanningCase, TODAY, tx


def put(client, body):
    return client.put("/api/planning/split/", json.dumps(body), content_type="application/json")


class LargestRemainderTests(PlanningCase):
    def test_sums_exactly(self):
        for total in (0, 1, 7, 100, 1_000_001):
            for weights in ([1, 1, 1], [50, 50], [33, 67], [0, 100]):
                parts = owner_money.largest_remainder(total, weights)
                self.assertEqual(sum(parts), total if sum(weights) else 0)
        self.assertEqual(owner_money.largest_remainder(10, [1, 1, 1]), [4, 3, 3])
        self.assertEqual(owner_money.largest_remainder(-5, [1, 1]), [0, 0])


class SplitTests(PlanningCase):
    def get(self):
        return self.client.get("/api/planning/split/")

    def test_empty_business(self):
        r = self.get().json()
        self.assertEqual((r["net"], r["afloat"]["amount"], r["development"]["amount"], r["owner"]["amount"]), (0, 0, 0, 0))
        self.assertFalse(r["configured"])

    def test_three_way_split(self):
        self.fund(10_000_000)
        Obligation.objects.create(business=self.business, title="Аренда", kind="rent", amount=2_000_000,
                                  due_date=TODAY + timedelta(days=5))
        Obligation.objects.create(business=self.business, title="Поздно", kind="rent", amount=9_000_000,
                                  due_date=TODAY + timedelta(days=45))
        Obligation.objects.create(business=self.business, title="Оплачено", kind="rent", amount=1_000_000,
                                  due_date=TODAY + timedelta(days=2), status="paid")
        Obligation.objects.create(business=self.business, title="Ждём", kind="receivable", amount=1_000_000,
                                  due_date=TODAY + timedelta(days=3))
        Person.objects.create(business=self.business, name="Али", kind="staff", pay_type="monthly", pay_amount=Decimal(3_000_000))
        Person.objects.create(business=self.business, name="Подрядчик", kind="contractor", pay_type="per_task", pay_amount=Decimal(500_000))
        assert put(self.client, {"development_pct": 30, "owner_pct": 70}).status_code == 200
        r = self.get().json()
        self.assertEqual(r["afloat"], {**r["afloat"], "amount": 5_000_000, "needed": 5_000_000, "payroll": 3_000_000, "obligations": 2_000_000})
        self.assertEqual([i["title"] for i in r["afloat"]["items"]], ["Аренда"])
        self.assertEqual((r["development"]["amount"], r["owner"]["amount"]), (1_500_000, 3_500_000))
        self.assertEqual(r["afloat"]["amount"] + r["development"]["amount"] + r["owner"]["amount"], r["net"])
        self.assertTrue(r["configured"])

    def test_salary_obligation_not_double_counted(self):
        self.fund(10_000_000)
        Obligation.objects.create(business=self.business, title="ЗП", kind="salary", amount=3_000_000, due_date=TODAY + timedelta(days=3))
        self.assertEqual(self.get().json()["afloat"]["needed"], 3_000_000)
        Person.objects.create(business=self.business, name="Али", kind="staff", pay_type="monthly", pay_amount=Decimal(3_000_000))
        self.assertEqual(self.get().json()["afloat"]["needed"], 3_000_000)

    def test_shortfall_leaves_nothing_for_shares(self):
        self.fund(1_000_000)
        Obligation.objects.create(business=self.business, title="Долг", kind="loan", amount=4_000_000, due_date=TODAY + timedelta(days=1))
        r = self.get().json()
        self.assertEqual((r["afloat"]["amount"], r["shortfall"], r["development"]["amount"], r["owner"]["amount"]), (1_000_000, 3_000_000, 0, 0))

    def test_recurring_commitments_counted(self):
        self.fund(10_000_000)
        Commitment.objects.create(business=self.business, account=self.account, title="Интернет", direction="out", category="Связь",
                                  amount=100_000, frequency="weekly", next_date=TODAY + timedelta(days=1))
        # 1, 8, 15, 22, 29 дней от сегодня — пять недель в окне 30 дней
        self.assertEqual(self.get().json()["afloat"]["obligations"], 500_000)

    def test_owner_money_separate_from_business(self):
        self.fund(5_000_000)
        tx(self.business, self.account, 700_000, "out", purpose="owner_draw", category="Выплата владельцу")
        tx(self.business, self.account, 200_000, "in", purpose="owner_contribution", category="Вклад владельца")
        r = self.get().json()
        self.assertEqual((r["owner_money"]["draw_month"], r["owner_money"]["contribution_month"]), (700_000, 200_000))
        self.assertEqual(r["balance"], 4_500_000)

    def test_put_validation_and_roles(self):
        for body in ({"development_pct": 30, "owner_pct": 60}, {"development_pct": -10, "owner_pct": 110},
                     {"development_pct": "30", "owner_pct": 70}, {"development_pct": 30}):
            self.assertEqual(put(self.client, body).status_code, 400, body)
        self.assertFalse(OwnerSplit.objects.exists())
        self.as_user(self.accountant)
        self.assertEqual(put(self.client, {"development_pct": 30, "owner_pct": 70}).status_code, 403)
        self.assertEqual(self.get().status_code, 200)
        self.as_user(self.seller)
        self.assertEqual(self.get().status_code, 403)

    def test_demo_tenant_write_blocked(self):
        self.business.is_demo = True
        self.business.save()
        r = put(self.client, {"development_pct": 30, "owner_pct": 70})
        self.assertEqual((r.status_code, r.json()["error"]), (403, "demo_tenant"))
        self.assertEqual(self.get().status_code, 200)

    def test_tenant_isolation(self):
        put(self.client, {"development_pct": 10, "owner_pct": 90})
        self.as_user(self.other_user)
        self.assertEqual(self.get().json()["development"]["pct"], 50)


class AffordReserveTests(PlanningCase):
    def post(self, **body):
        body.setdefault("currency", "UZS")
        return self.client.post("/api/planning/afford/", json.dumps(body), content_type="application/json")

    def test_reserve_flips_verdict_and_reports_numbers(self):
        self.fund(10_000_000)
        ok = self.post(amount=4_000_000).json()
        self.assertEqual(ok["verdict"], "yes")
        self.assertEqual(ok["earliest_date"], TODAY.isoformat())
        self.assertEqual(ok["numbers"]["max_affordable"], 10_000_000)
        tight = self.post(amount=4_000_000, reserve=7_000_000).json()
        self.assertEqual(tight["verdict"], "risky")
        self.assertEqual(tight["numbers"]["extra_reserve"], 7_000_000)
        self.assertEqual(tight["numbers"]["buffer"], 7_000_000)
        self.assertEqual(tight["numbers"]["max_affordable"], 3_000_000)

    def test_when_is_next_possible_date(self):
        self.fund(1_000_000)
        Obligation.objects.create(business=self.business, title="Клиент", kind="receivable", amount=5_000_000,
                                  due_date=TODAY + timedelta(days=10))
        r = self.post(amount=3_000_000).json()
        self.assertEqual(r["verdict"], "no")
        self.assertIsNotNone(r["earliest_date"])
        self.assertGreater(r["earliest_date"], TODAY.isoformat())

    def test_never_when_money_does_not_come(self):
        r = self.post(amount=3_000_000).json()
        self.assertEqual((r["verdict"], r["earliest_date"]), ("no", None))

    def test_bad_reserve_rejected(self):
        self.assertEqual(self.post(amount=1000, reserve=-5).status_code, 400)
        self.assertEqual(self.post(amount=1000, reserve="много").status_code, 400)
