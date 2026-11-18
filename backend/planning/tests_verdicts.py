from datetime import timedelta

from .tests_today import TODAY, URL, PlanningCase, obligation, weekday


class VerdictTests(PlanningCase):
    """Границы вердикта: gap — баланс < 0 в окне; tight — can_take == 0 или < 10% оттока окна; иначе ok."""

    RENT = 5_000_000

    def verdict(self, opening, rent_days=3, **q):
        self.fund(opening)
        due = weekday(rent_days)
        obligation(self.business, "Аренда", "rent", self.RENT, due)
        until = (TODAY + timedelta(days=due)).isoformat()
        r = self.client.get(f"{URL}?until={until}")
        self.assertEqual(r.status_code, 200)
        return r.json()

    def test_gap_when_balance_goes_negative(self):
        body = self.verdict(self.RENT - 1)
        self.assertEqual(body["verdict"], "gap")
        self.assertEqual(body["gap"]["amount"], 1)
        self.assertEqual(body["can_take"], 0)

    def test_tight_when_exactly_covered(self):
        body = self.verdict(self.RENT)
        self.assertEqual((body["verdict"], body["can_take"], body["gap"]), ("tight", 0, None))

    def test_tight_when_spare_below_ten_percent_of_outflow(self):
        body = self.verdict(self.RENT + self.RENT // 10 - 1)  # запас на 1 меньше 10% оттока
        self.assertEqual(body["verdict"], "tight")
        self.assertEqual(body["can_take"], self.RENT // 10 - 1)
        self.assertGreater(body["can_take"], 0)
        self.assertIsNone(body["gap"])

    def test_ok_at_ten_percent_boundary(self):
        body = self.verdict(self.RENT + self.RENT // 10)  # can_take * 10 == outflow: уже не tight
        self.assertEqual(body["verdict"], "ok")
        self.assertEqual(body["can_take"], self.RENT // 10)
        self.assertIsNone(body["gap"])

    def test_ok_response_shape(self):
        body = self.verdict(100_000_000)
        self.assertEqual(set(body), {"as_of", "until", "until_reason", "balance", "can_take", "verdict",
                                     "low", "gap", "tax_reserve", "items", "totals"})
        self.assertEqual(body["verdict"], "ok")
        self.assertEqual(body["until_reason"], "param")
        self.assertEqual(set(body["totals"]), {"inflow", "outflow", "end_balance"})
        self.assertEqual(body["totals"]["outflow"], -self.RENT)
