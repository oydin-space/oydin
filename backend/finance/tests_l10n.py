import re
from datetime import date, timedelta

from django.contrib.auth import get_user_model
from django.test import SimpleTestCase, TestCase

from accounts.models import Business, Profile
from finance import services as svc
from finance.domain.forecast import Flow, build_forecast, find_gap
from finance.models import Account, Obligation, Transaction
from finance.texts import date_text, money

CYRILLIC = re.compile("[А-Яа-яЁё]")
D = date(2026, 1, 1)


class TextHelpersTests(SimpleTestCase):
    def test_money_per_language(self):
        self.assertEqual(money(3_100_000, "ru"), "3,1 млн")
        self.assertEqual(money(3_100_000, "uz"), "3,1 mln")
        self.assertEqual(money(3_100_000, "en"), "3.1M")
        self.assertEqual(money(500, "uz"), "500 soʻm")

    def test_date_per_language(self):
        self.assertEqual(date_text(date(2026, 12, 10), "ru"), "10 декабря")
        self.assertEqual(date_text(date(2026, 12, 10), "uz"), "10-dekabr")
        self.assertEqual(date_text(date(2026, 12, 10), "en"), "December 10")

    def test_gap_reason_localized(self):
        flows = [Flow(D + timedelta(days=5), -15_000_000, "Salary")]
        points = build_forecast(D, 1_000_000, flows, 0, 0, 30)
        for lang in ("uz", "en"):
            reason = find_gap(points, flows, D, lang=lang).reason
            self.assertIn("Salary", reason)
            self.assertFalse(CYRILLIC.search(reason), reason)
        self.assertIn("15 млн", find_gap(points, flows, D).reason)

    def test_uzbek_uses_modifier_letters(self):
        reason = find_gap(build_forecast(D, 0, [], 0, 10, 30), [], D, lang="uz").reason
        self.assertNotIn("'", reason)


class PulseL10nTests(TestCase):
    def setUp(self):
        self.user = get_user_model().objects.create(username="l10n")
        self.business = Business.objects.create(name="l10n")
        Profile.objects.create(user=self.user, business=self.business)
        self.cash = Account.objects.create(business=self.business, name="Cash", kind="cash")
        self.bank = Account.objects.create(business=self.business, name="Bank", kind="bank")
        now = svc.today()
        Transaction.objects.create(
            business=self.business, account=self.cash, date=now, amount=1_000_000, direction="in",
            category="Sales", status="confirmed", source="manual",
        )
        Obligation.objects.create(
            business=self.business, title="Salary", kind="salary", amount=15_000_000, due_date=now + timedelta(days=5),
        )
        self.client.force_login(self.user)

    def test_pulse_has_no_cyrillic_in_uz_en(self):
        for lang in ("uz", "en"):
            body = self.client.get("/api/dashboard/pulse/", headers={"Accept-Language": lang}).json()
            texts = [body["headline"], body["gap"]["reason"]]
            texts += [m["label"] + " " + m["hint"] for m in body["metrics"]]
            for text in texts:
                self.assertFalse(CYRILLIC.search(text), (lang, text))

    def test_pulse_default_is_russian(self):
        body = self.client.get("/api/dashboard/pulse/").json()
        self.assertIn("не хватит", body["headline"])
        self.assertIn("«Salary»", body["gap"]["reason"])

    def test_transfer_category_localized_on_output_only(self):
        tx = Transaction.objects.create(
            business=self.business, account=self.cash, transfer_account=self.bank, date=svc.today(), amount=100_000,
            direction="transfer", category="Перевод между счетами", status="confirmed", source="manual",
        )
        for lang, expected in (("ru", "Перевод между счетами"), ("uz", "Hisoblar oʻrtasida oʻtkazma"),
                               ("en", "Transfer between accounts")):
            items = self.client.get("/api/transactions/", headers={"Accept-Language": lang}).json()["items"]
            self.assertEqual([i["category"] for i in items if i["id"] == tx.id], [expected])
        tx.refresh_from_db()
        self.assertEqual(tx.category, "Перевод между счетами")
