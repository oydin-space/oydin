from django.test import TestCase

from finance.models import Transaction
from finance.tests import make_user


def post(client, url, body):
    return client.post(url, body, content_type="application/json")


class EdgeFixTests(TestCase):
    def setUp(self):
        self.user, self.business, self.account = make_user("edge")
        self.client.force_login(self.user)

    def tx_body(self, **extra):
        return {"amount": 1000, "direction": "in", "category": "x", "account_id": self.account.id, **extra}

    def test_far_dates_rejected_and_nothing_saved(self):
        for d in ("0001-01-01", "9999-12-31", "1999-12-31", "2101-01-01"):
            r = post(self.client, "/api/transactions/", self.tx_body(date=d))
            self.assertEqual(r.status_code, 400, d)
            self.assertEqual(r.json()["error"], "invalid_date")
        self.assertEqual(Transaction.objects.count(), 0)

    def test_nul_in_json_and_query(self):
        r = post(self.client, "/api/transactions/", self.tx_body(note="a\u0000b"))
        self.assertEqual(r.status_code, 400)
        r = post(self.client, "/api/transactions/", self.tx_body(counterparty=["a\u0000"]))
        self.assertEqual(r.status_code, 400)
        self.assertEqual(self.client.get("/api/transactions/", {"q": "a\u0000b"}).status_code, 400)

    def test_kind_list_is_400(self):
        r = post(self.client, "/api/obligations/", {"title": "t", "kind": ["x"], "amount": 5, "due_date": "2026-01-01"})
        self.assertEqual(r.status_code, 400)

    def test_note_cap(self):
        self.assertEqual(post(self.client, "/api/transactions/", self.tx_body(note="n" * 1001)).status_code, 400)
        self.assertEqual(post(self.client, "/api/transactions/", self.tx_body(note="n" * 1000)).status_code, 201)

    def test_commitment_far_next_date_rejected(self):
        body = {"title": "Rent", "category": "Аренда", "amount": 100, "frequency": "monthly",
                "account_id": self.account.id, "direction": "out"}
        r = post(self.client, "/api/commitments/", {**body, "next_date": "9999-12-31"})
        self.assertEqual(r.status_code, 400)
        r = post(self.client, "/api/commitments/", {**body, "next_date": "2100-12-31"})
        self.assertIn(r.status_code, (201, 400))
        if r.status_code == 201:
            c = self.client.post(f"/api/commitments/{r.json()['id']}/confirm/")
            self.assertEqual(c.status_code, 201)

    def test_planning_choice_list_is_400(self):
        r = post(self.client, "/api/decisions/afford/", {"currency": ["UZS"], "amount": 5})
        self.assertEqual(r.status_code, 400)
