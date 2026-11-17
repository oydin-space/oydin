from django.test import TestCase

from accounts.models import Business
from insights.services import build_insights


class InsightsTests(TestCase):
    def test_no_tax_calculator(self):
        business = Business.objects.create(name="b", tax_regime="turnover")
        self.assertFalse([i for i in build_insights(business) if i["kind"] == "tax"])
