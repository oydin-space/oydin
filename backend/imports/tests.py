import io
from datetime import date
from pathlib import Path
from unittest import mock

from django.contrib.auth import get_user_model
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase, TestCase
from openpyxl import Workbook, load_workbook

from accounts.consent import set_consent
from accounts.http import ApiError
from accounts.models import Business, Membership, Profile
from finance.models import Account, Transaction

from . import export, mapping, parsers, services
from .models import ImportJob, ImportMapping

FIXTURES = Path(__file__).parent / "fixtures"


def fixture(name):
    return (FIXTURES / name).read_bytes()


def make_member(name, role="owner", business=None):
    user = get_user_model().objects.create(username=name)
    business = business or Business.objects.create(name=f"biz-{name}")
    Membership.objects.create(user=user, business=business, role=role)
    Profile.objects.create(user=user, business=business)
    return user, business


def xlsx_bytes(rows):
    wb = Workbook()
    ws = wb.active
    for r in rows:
        ws.append(r)
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


class AmountDateTests(SimpleTestCase):
    def test_amount_formats(self):
        for raw, expected in [("1 500 000,00", 1500000), ("1,500,000.00", 1500000), ("1.500.000", 1500000),
                              ("250000", 250000), ("-250 000", -250000), ("(300)", -300), ("1,500", 1500),
                              ("1500.50", 1500.5), ("12 000 сум", 12000)]:
            self.assertEqual(float(services.parse_amount(raw)), expected, raw)
        for bad in ("", "abc", '=HYPERLINK("x")', "1-2"):
            self.assertIsNone(services.parse_amount(bad), bad)

    def test_dates(self):
        self.assertEqual(services.parse_date("05.03.2026"), date(2026, 3, 5))
        self.assertEqual(services.parse_date("2026-03-05 10:00:00"), date(2026, 3, 5))
        self.assertIsNone(services.parse_date("вчера"))


class HeuristicMappingTests(SimpleTestCase):
    def test_russian(self):
        m, conf = mapping.heuristic(["Дата", "Сумма", "Контрагент", "Назначение", "Лишнее"])
        self.assertEqual(m, {"Дата": "date", "Сумма": "amount", "Контрагент": "counterparty",
                             "Назначение": "note", "Лишнее": "skip"})
        self.assertGreater(conf, 0.6)

    def test_uzbek_in_out(self):
        m, _ = mapping.heuristic(["Sana", "Kirim", "Chiqim", "Kontragent", "Izoh"])
        self.assertEqual(list(m.values()), ["date", "inflow", "outflow", "counterparty", "note"])

    def test_english_and_missing_required(self):
        m, conf = mapping.heuristic(["Date", "Amount", "Comment"])
        self.assertEqual(list(m.values()), ["date", "amount", "note"])
        self.assertEqual(mapping.heuristic(["foo", "bar"])[1], 0.0)

    def test_inflow_wins_over_amount(self):
        m, _ = mapping.heuristic(["Дата", "Сумма прихода", "Сумма расхода"])
        self.assertEqual(list(m.values()), ["date", "inflow", "outflow"])


class ParserTests(SimpleTestCase):
    def test_csv_semicolon(self):
        columns, rows = parsers.parse_csv(fixture("sales.csv"))
        self.assertEqual(columns, ["Дата", "Сумма", "Контрагент", "Назначение", "Категория"])
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[0]["Контрагент"], "ИП Каримов")

    def test_csv_cp1251(self):
        data = "Дата;Сумма\r\n01.03.2026;100\r\n".encode("cp1251")
        self.assertEqual(parsers.parse_csv(data)[0], ["Дата", "Сумма"])

    def test_xlsx(self):
        data = xlsx_bytes([["Date", "Amount"], [date(2026, 3, 1), 1500.0], [None, None]])
        columns, rows = parsers.parse_xlsx(data)
        self.assertEqual(rows, [{"Date": "2026-03-01", "Amount": "1500"}])

    def test_1c_both_encodings(self):
        for name in ("bank_1c_cp1251.txt", "bank_1c_utf8.txt"):
            columns, rows = parsers.parse_1c(fixture(name))
            self.assertEqual(columns, parsers.FIXED_COLUMNS, name)
            self.assertEqual(rows[0], {"date": "05.03.2026", "amount": "1500000.00", "direction": "in",
                                       "counterparty": "ООО Ромашка", "note": "Оплата по счёту 15"})
            self.assertEqual((rows[1]["direction"], rows[1]["counterparty"]), ("out", "ООО Поставщик"))

    def test_commerceml_orders(self):
        _, rows = parsers.parse_commerceml(fixture("orders_commerceml.xml"))
        self.assertEqual(len(rows), 2)
        self.assertEqual(rows[0], {"date": "2026-03-09", "amount": "450000.00", "direction": "in",
                                   "counterparty": "Алишер Каримов", "note": "Заказ 100 Самовывоз"})

    def test_malformed(self):
        cases = [
            (parsers.parse_csv, b""), (parsers.parse_csv, b"\x00\x01\x02binary"), (parsers.parse_csv, b"onlyheader\n"),
            (parsers.parse_xlsx, b"not a zip"), (parsers.parse_1c, b"hello"), (parsers.parse_1c, b"1CClientBankExchange\n"),
            (parsers.parse_commerceml, b"<a><b></a>"), (parsers.parse_commerceml, fixture("catalog_commerceml.xml")),
            (parsers.parse_commerceml, '<!DOCTYPE x [<!ENTITY a "b">]><КоммерческаяИнформация/>'.encode()),
        ]
        for fn, data in cases:
            with self.assertRaises(ApiError, msg=(fn.__name__, data[:20])) as ctx:
                fn(data)
            self.assertEqual((ctx.exception.status, ctx.exception.message), (400, "invalid_file"))


class ImportApiTests(TestCase):
    def setUp(self):
        self.owner, self.business = make_member("owner")
        self.account = Account.objects.create(business=self.business, name="Наличные", kind="cash")
        self.client.force_login(self.owner)

    def upload(self, name, data, **extra):
        return self.client.post("/api/imports/", {"file": SimpleUploadedFile(name, data), **extra})

    def test_csv_preview_does_not_save(self):
        r = self.upload("sales.csv", fixture("sales.csv"))
        self.assertEqual(r.status_code, 201, r.content)
        body = r.json()
        self.assertEqual(body["kind"], "csv")
        self.assertEqual(body["status"], "preview")
        self.assertEqual(body["mapping"]["Сумма"], "amount")
        self.assertEqual(body["total_rows"], 3)
        first, second, third = body["preview"]
        self.assertEqual(first["draft"]["amount"], 1500000)
        self.assertEqual(first["draft"]["direction"], "in")
        self.assertEqual(first["draft"]["date"], "2026-03-01")
        self.assertEqual(second["draft"]["direction"], "out")
        self.assertEqual(second["draft"]["amount"], 250000)
        self.assertEqual(third["errors"], ["amount"])  # формула не принимается как сумма
        self.assertEqual(Transaction.objects.count(), 0)

    def test_commit_creates_drafts_only(self):
        job = self.upload("sales.csv", fixture("sales.csv")).json()
        r = self.client.post(f"/api/imports/{job['id']}/commit/", {}, content_type="application/json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["created_count"], 2)
        self.assertEqual(r.json()["status"], "committed")
        txs = Transaction.objects.filter(business=self.business)
        self.assertEqual({t.status for t in txs}, {"draft"})
        self.assertEqual({t.source for t in txs}, {"import"})
        self.assertEqual({t.created_by_id for t in txs}, {self.owner.id})
        self.assertEqual(txs.get(counterparty="ИП Каримов").category, "Розница")
        again = self.client.post(f"/api/imports/{job['id']}/commit/", {}, content_type="application/json")
        self.assertEqual(again.status_code, 409)

    def test_inflow_outflow_columns(self):
        job = self.upload("inout.csv", fixture("inout.csv")).json()
        self.assertEqual(job["mapping"]["Kirim"], "inflow")
        self.assertEqual([r["draft"]["direction"] for r in job["preview"]], ["in", "out"])
        self.assertEqual([r["draft"]["amount"] for r in job["preview"]], [1200000, 300000])

    def test_xlsx_upload(self):
        data = xlsx_bytes([["Date", "Amount", "Counterparty"], [date(2026, 3, 1), 99000, "Shop"]])
        body = self.upload("report.xlsx", data).json()
        self.assertEqual(body["kind"], "xlsx")
        self.assertEqual(body["preview"][0]["draft"]["amount"], 99000)

    def test_1c_upload_and_commit(self):
        body = self.upload("bank.txt", fixture("bank_1c_cp1251.txt")).json()
        self.assertEqual((body["kind"], body["mapping_confidence"]), ("1c_bank", 1.0))
        self.assertEqual(body["preview"][1]["draft"]["amount"], 320001)  # 320000.50 → half-up
        self.client.post(f"/api/imports/{body['id']}/commit/", {}, content_type="application/json")
        self.assertEqual(Transaction.objects.filter(status="draft", source="import").count(), 2)

    def test_commerceml_upload(self):
        body = self.upload("orders.xml", fixture("orders_commerceml.xml")).json()
        self.assertEqual(body["kind"], "commerceml")
        self.assertEqual(body["preview"][0]["draft"]["counterparty"], "Алишер Каримов")

    def test_malformed_files_400(self):
        for name, data, extra in [("a.csv", b"", {}), ("a.xlsx", b"garbage", {}), ("a.txt", b"nothing", {}),
                                  ("a.xml", b"<x>", {}), ("a.csv", b"x\x00y", {}), ("a.xlsx", fixture("sales.csv"), {"kind": "xlsx"})]:
            r = self.upload(name, data, **extra)
            self.assertEqual((r.status_code, r.json()), (400, {"error": "invalid_file"}), name)
        self.assertEqual(self.client.post("/api/imports/", {}).json(), {"error": "invalid_file"})
        self.assertEqual(ImportJob.objects.count(), 0)

    def test_size_and_row_limits(self):
        r = self.upload("big.csv", b"a,b\n" + b"1,2\n" * (parsers.MAX_BYTES // 4 + 10))
        self.assertEqual((r.status_code, r.json()), (413, {"error": "file_too_large"}))
        with mock.patch.object(parsers, "MAX_ROWS", 2):
            r = self.upload("rows.csv", b"Date,Amount\n2026-03-01,1\n2026-03-02,2\n2026-03-03,3\n")
        self.assertEqual((r.status_code, r.json()), (413, {"error": "too_many_rows"}))

    def test_invalid_kind(self):
        self.assertEqual(self.upload("a.csv", fixture("sales.csv"), kind="pdf").status_code, 400)

    def test_dedupe_against_existing(self):
        Transaction.objects.create(business=self.business, account=self.account, date=date(2026, 3, 1),
                                   amount=1500000, direction="in", category="x", counterparty="ип каримов ")
        job = self.upload("sales.csv", fixture("sales.csv")).json()
        self.assertEqual([r["duplicate"] for r in job["preview"]], [True, False, False])
        r = self.client.post(f"/api/imports/{job['id']}/commit/", {"skip_duplicates": True}, content_type="application/json")
        self.assertEqual(r.json()["created_count"], 1)
        job2 = self.upload("sales.csv", fixture("sales.csv")).json()
        r = self.client.post(f"/api/imports/{job2['id']}/commit/", {"skip_duplicates": False}, content_type="application/json")
        self.assertEqual(r.json()["created_count"], 2)  # дубль первой строки создан, строка 2 уже есть как draft

    def test_dedupe_other_account_not_duplicate(self):
        other = Account.objects.create(business=self.business, name="Карта", kind="card")
        Transaction.objects.create(business=self.business, account=other, date=date(2026, 3, 1),
                                   amount=1500000, direction="in", category="x", counterparty="ИП Каримов")
        job = self.upload("sales.csv", fixture("sales.csv"), account_id=self.account.id).json()
        self.assertFalse(job["preview"][0]["duplicate"])

    def test_exclude_rows(self):
        job = self.upload("sales.csv", fixture("sales.csv")).json()
        r = self.client.post(f"/api/imports/{job['id']}/commit/", {"exclude_rows": [1]}, content_type="application/json")
        self.assertEqual(r.json()["created_count"], 1)

    def test_patch_mapping_recomputes_preview(self):
        job = self.upload("sales.csv", fixture("sales.csv")).json()
        new = {**job["mapping"], "Категория": "note", "Назначение": "category"}
        r = self.client.patch(f"/api/imports/{job['id']}/", new_body(new), content_type="application/json")
        self.assertEqual(r.status_code, 200, r.content)
        self.assertEqual(r.json()["preview"][0]["draft"]["category"], "Оплата за товар")
        self.assertEqual(r.json()["mapping_confidence"], 1.0)

    def test_patch_validation(self):
        job = self.upload("sales.csv", fixture("sales.csv")).json()
        url = f"/api/imports/{job['id']}/"
        for body in ({"mapping": {"Дата": "bogus"}}, {"mapping": {c: "skip" for c in job["columns"]}},
                     {"mapping": "x"}, {"account_id": 99999}):
            r = self.client.patch(url, body, content_type="application/json")
            self.assertEqual(r.status_code, 400, body)
        self.client.post(url + "commit/", {}, content_type="application/json")
        self.assertEqual(self.client.patch(url, {"mapping": job["mapping"]}, content_type="application/json").status_code, 409)

    def test_mapping_memory(self):
        job = self.upload("sales.csv", fixture("sales.csv")).json()
        custom = {**job["mapping"], "Категория": "skip"}
        self.client.patch(f"/api/imports/{job['id']}/", {"mapping": custom}, content_type="application/json")
        self.client.post(f"/api/imports/{job['id']}/commit/", {}, content_type="application/json")
        self.assertEqual(ImportMapping.objects.get(business=self.business).mapping, custom)
        # тот же набор колонок в другом порядке → запомненный маппинг, уверенность 1.0
        reordered = "Категория;Дата;Сумма;Контрагент;Назначение\nX;01.04.2026;5;A;B\n".encode()
        again = self.upload("again.csv", reordered).json()
        self.assertEqual(again["mapping"], custom)
        self.assertEqual(again["mapping_confidence"], 1.0)
        # у другого бизнеса памяти нет
        other, _ = make_member("other")
        self.client.force_login(other)
        Account.objects.create(business=Business.objects.get(name="biz-other"), name="K", kind="cash")
        self.assertEqual(self.upload("again.csv", reordered).json()["mapping"]["Категория"], "category")

    def test_ai_mapping_used_when_configured_and_falls_back(self):
        data = b"Q1;Q2\n2026-03-01;500\n"
        reply = {"mapping": {"Q1": "date", "Q2": "amount"}, "confidence": 0.9}
        with mock.patch("ai.llm.is_configured", return_value=True), mock.patch("ai.llm.complete", return_value=reply) as llm:
            body = self.upload("q.csv", data).json()
            self.assertFalse(llm.called)  # без согласия "ai" данные наружу не уходят
            self.assertEqual(body["mapping_confidence"], 0.0)
            set_consent(self.owner, "ai", True)
            body = self.upload("q.csv", data).json()
        self.assertEqual((body["mapping"], body["mapping_confidence"]), (reply["mapping"], 0.9))
        for failing in (mock.Mock(side_effect=RuntimeError("down")), mock.Mock(return_value={"mapping": {"Q1": "nope"}})):
            with mock.patch("ai.llm.is_configured", return_value=True), mock.patch("ai.llm.complete", failing):
                body = self.upload("q.csv", b"Date;Amount\n2026-03-01;500\n").json()
            self.assertEqual(body["mapping"], {"Date": "date", "Amount": "amount"})

    def test_account_column_and_default(self):
        Account.objects.create(business=self.business, name="Карта", kind="card")
        data = "Date,Amount,Account\n2026-03-01,10,карта\n2026-03-02,20,\n".encode()
        body = self.upload("acc.csv", data, account_id=self.account.id).json()
        card = Account.objects.get(name="Карта")
        self.assertEqual([r["draft"]["account_id"] for r in body["preview"]], [card.id, self.account.id])

    def test_no_account_is_row_error(self):
        self.account.delete()
        body = self.upload("sales.csv", fixture("sales.csv")).json()
        self.assertIn("account", body["preview"][0]["errors"])
        r = self.client.post(f"/api/imports/{body['id']}/commit/", {}, content_type="application/json")
        self.assertEqual(r.json()["created_count"], 0)

    def test_foreign_account_rejected(self):
        _, other_business = make_member("x")
        foreign = Account.objects.create(business=other_business, name="F", kind="cash")
        r = self.upload("sales.csv", fixture("sales.csv"), account_id=foreign.id)
        self.assertEqual((r.status_code, r.json()), (400, {"error": "invalid_account"}))

    def test_list(self):
        self.upload("sales.csv", fixture("sales.csv"))
        items = self.client.get("/api/imports/").json()["items"]
        self.assertEqual(len(items), 1)
        self.assertEqual(items[0]["preview"], [])


def new_body(mapping_):
    return {"mapping": mapping_}


class RoleAndTenantTests(TestCase):
    def setUp(self):
        self.owner, self.business = make_member("owner")
        Account.objects.create(business=self.business, name="Наличные", kind="cash")
        self.accountant, _ = make_member("acc", "accountant", self.business)
        self.seller, _ = make_member("sel", "seller", self.business)
        self.stranger, self.other_business = make_member("stranger")
        self.client.force_login(self.owner)
        self.job = self.client.post("/api/imports/", {"file": SimpleUploadedFile("s.csv", fixture("sales.csv"))}).json()

    def test_seller_forbidden_everywhere(self):
        self.client.force_login(self.seller)
        job = f"/api/imports/{self.job['id']}/"
        for method, url in [("get", "/api/imports/"), ("post", "/api/imports/"), ("get", job), ("patch", job),
                            ("post", job + "commit/"), ("get", "/api/exports/transactions/?format=csv")]:
            r = getattr(self.client, method)(url)
            self.assertEqual((r.status_code, r.json()), (403, {"error": "forbidden"}), (method, url))

    def test_accountant_allowed(self):
        self.client.force_login(self.accountant)
        self.assertEqual(self.client.get("/api/imports/").status_code, 200)
        self.assertEqual(self.client.get("/api/exports/transactions/?format=csv").status_code, 200)

    def test_unauthenticated(self):
        self.client.logout()
        self.assertEqual(self.client.get("/api/imports/").status_code, 401)
        self.assertEqual(self.client.get("/api/exports/transactions/?format=csv").status_code, 401)

    def test_tenant_isolation(self):
        self.client.force_login(self.stranger)
        job = f"/api/imports/{self.job['id']}/"
        self.assertEqual(self.client.get(job).status_code, 404)
        self.assertEqual(self.client.patch(job, {"mapping": {}}, content_type="application/json").status_code, 404)
        self.assertEqual(self.client.post(job + "commit/").status_code, 404)
        self.assertEqual(self.client.get("/api/imports/").json(), {"items": []})
        Transaction.objects.create(business=self.business, account=Account.objects.get(business=self.business),
                                   date=date(2026, 3, 1), amount=1, direction="in", category="secret")
        body = self.client.get("/api/exports/transactions/?format=csv").content.decode("utf-8-sig")
        self.assertNotIn("secret", body)


class ExportTests(TestCase):
    def setUp(self):
        self.owner, self.business = make_member("owner")
        self.account = Account.objects.create(business=self.business, name="Наличные", kind="cash")
        self.client.force_login(self.owner)

    def add(self, day, **kw):
        defaults = dict(business=self.business, account=self.account, date=day, amount=1000, direction="in",
                        category="Розница", counterparty="Клиент", note="")
        return Transaction.objects.create(**{**defaults, **kw})

    def test_csv_with_filters(self):
        self.add(date(2026, 3, 1), counterparty="Март")
        self.add(date(2026, 4, 1), counterparty="Апрель")
        r = self.client.get("/api/exports/transactions/?format=csv&from=2026-03-15&to=2026-04-30")
        self.assertEqual(r.status_code, 200)
        self.assertIn("attachment", r["Content-Disposition"])
        self.assertTrue(r["Content-Type"].startswith("text/csv"))
        text = r.content.decode("utf-8-sig")
        self.assertIn("Апрель", text)
        self.assertNotIn("Март", text)
        self.assertTrue(text.startswith("date,direction,amount"))

    def test_csv_injection_escaped(self):
        for i, payload in enumerate(["=1+1", "+7 900", "-2+3", "@SUM(A1)"]):
            self.add(date(2026, 3, 1), counterparty=payload, note=payload, category=payload)
        text = self.client.get("/api/exports/transactions/?format=csv").content.decode("utf-8-sig")
        for payload in ["=1+1", "+7 900", "-2+3", "@SUM(A1)"]:
            self.assertIn("'" + payload, text)
        for line in text.splitlines()[1:]:
            for cell in line.split(","):
                self.assertFalse(cell[:1] in "=+-@" and cell, line)

    def test_xlsx_escaped_and_readable(self):
        self.add(date(2026, 3, 1), counterparty="=cmd|' /C calc'!A0", amount=777)
        r = self.client.get("/api/exports/transactions/?format=xlsx")
        self.assertEqual(r.status_code, 200)
        ws = load_workbook(io.BytesIO(r.content)).worksheets[0]
        rows = list(ws.iter_rows(values_only=True))
        self.assertEqual(rows[0][0], "date")
        self.assertEqual(rows[1][2], 777)
        self.assertEqual(rows[1][4], "'=cmd|' /C calc'!A0")

    def test_1c_export_roundtrips_through_import(self):
        self.add(date(2026, 3, 5), amount=5000, counterparty="ООО Ромашка", note="Оплата")
        self.add(date(2026, 3, 6), amount=700, direction="out", counterparty="ИП Иванов", note="Закупка")
        r = self.client.get("/api/exports/transactions/?format=1c_bank")
        self.assertEqual(r["Content-Type"], "text/plain; charset=windows-1251")
        self.assertTrue(r.content.startswith(b"1CClientBankExchange"))
        _, rows = parsers.parse_1c(r.content)
        self.assertEqual([(x["direction"], x["amount"], x["counterparty"]) for x in rows],
                         [("in", "5000.00", "ООО Ромашка"), ("out", "700.00", "ИП Иванов")])

    def test_validation(self):
        for q in ("", "?format=pdf", "?format=csv&from=nope", "?format=csv&to=2026-13-01"):
            self.assertEqual(self.client.get(f"/api/exports/transactions/{q}").status_code, 400, q)

    def test_row_limit(self):
        self.add(date(2026, 3, 1))
        self.add(date(2026, 3, 2))
        with mock.patch.object(export, "MAX_ROWS", 1):
            r = self.client.get("/api/exports/transactions/?format=csv")
        self.assertEqual((r.status_code, r.json()), (400, {"error": "too_many_rows"}))

    def test_export_includes_drafts_with_status_column(self):
        self.add(date(2026, 3, 1), status="draft")
        text = self.client.get("/api/exports/transactions/?format=csv").content.decode("utf-8-sig")
        self.assertIn(",draft", text)
