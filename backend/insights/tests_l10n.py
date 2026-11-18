import re
from datetime import timedelta

from django.contrib.auth import get_user_model
from django.test import TestCase

from accounts.models import Business, Profile
from finance import services as svc
from finance.models import Account, Obligation, Transaction
from insights.services import build_insights

CYRILLIC = re.compile("[А-Яа-яЁё]")


class InsightsL10nTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create(username="ins")
        self.business = Business.objects.create(name="ins")
        Profile.objects.create(user=self.user, business=self.business)
        account = Account.objects.create(business=self.business, name="Cash", kind="cash")
        now = svc.today()
        for days_ago, amount in ((45, 200_000), (5, 400_000)):
            Transaction.objects.create(
                business=self.business, account=account, date=now - timedelta(days=days_ago), amount=amount,
                direction="out", category="Ads", purpose="business", status="confirmed", source="manual",
            )
        Obligation.objects.create(
            business=self.business, title="Salary", kind="salary", amount=15_000_000, due_date=now + timedelta(days=5),
        )
        self.client.force_login(self.user)

    def test_no_cyrillic_in_uz_en(self):
        for lang in ("uz", "en"):
            items = self.client.get("/api/insights/", headers={"Accept-Language": lang}).json()["items"]
            self.assertEqual({"own-cash-gap", "own-category-growth", "market-december-b2b", "local-prepay-habit"},
                             {i["id"] for i in items})
            for item in items:
                for field in ("title", "body", "source", "action"):
                    self.assertFalse(CYRILLIC.search(item[field]), (lang, item["id"], field, item[field]))
                    self.assertNotIn("'", item[field])

    def test_default_language_is_russian(self):
        items = self.client.get("/api/insights/").json()["items"]
        self.assertTrue(any(CYRILLIC.search(i["title"]) for i in items))

    def test_service_default_without_request(self):
        self.assertTrue(CYRILLIC.search(build_insights(self.business)[0]["title"]))
