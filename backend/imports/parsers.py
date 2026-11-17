"""Разбор файлов в таблицу: (columns, rows), где row — dict колонка → строка.

Любая ошибка формата — ApiError(400, "invalid_file"). Известные форматы (1С, CommerceML)
сразу приводятся к колонкам FIXED_COLUMNS."""

import csv
import io
import re
import zipfile
from datetime import date, datetime
from xml.etree import ElementTree

from accounts.http import ApiError

MAX_BYTES = 5 * 1024 * 1024
MAX_ROWS = 20_000
FIXED_COLUMNS = ["date", "amount", "direction", "counterparty", "note"]
FIXED_MAPPING = {c: c for c in FIXED_COLUMNS}


def invalid():
    return ApiError(400, "invalid_file")


def decode(data):
    if b"\x00" in data:
        raise invalid()
    for enc in ("utf-8-sig", "cp1251"):
        try:
            return data.decode(enc)
        except UnicodeDecodeError:
            continue
    raise invalid()


def unique_headers(raw):
    seen, out = {}, []
    for i, h in enumerate(raw, 1):
        name = (h or "").strip() or f"col_{i}"
        seen[name] = seen.get(name, 0) + 1
        out.append(name if seen[name] == 1 else f"{name}_{seen[name]}")
    return out


def table(header, body):
    """header — список заголовков; body — списки значений. Пустые строки отбрасываются."""
    columns = unique_headers(header)
    rows = []
    for values in body:
        cells = ["" if v is None else str(v).strip() for v in values]
        if not any(cells):
            continue
        cells += [""] * (len(columns) - len(cells))
        rows.append(dict(zip(columns, cells[: len(columns)])))
        if len(rows) > MAX_ROWS:
            raise ApiError(413, "too_many_rows")
    if not columns or not rows:
        raise invalid()
    return columns, rows


def parse_csv(data):
    text = decode(data)
    first = text.splitlines()[0] if text.strip() else ""
    delimiter = max(";,\t|", key=first.count)
    if first.count(delimiter) == 0:
        raise invalid()
    try:
        records = list(csv.reader(io.StringIO(text), delimiter=delimiter))
    except csv.Error:
        raise invalid() from None
    records = [r for r in records if any(c.strip() for c in r)]
    if len(records) < 2:
        raise invalid()
    return table(records[0], records[1:])


def cell_text(value):
    if isinstance(value, datetime):
        return value.date().isoformat() if value.time().isoformat() == "00:00:00" else value.isoformat(sep=" ")
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, float) and value.is_integer():
        return str(int(value))
    return value


def parse_xlsx(data):
    from openpyxl import load_workbook

    try:
        sheet = load_workbook(io.BytesIO(data), read_only=True, data_only=True).worksheets[0]
        records = []
        for row in sheet.iter_rows(values_only=True):
            if any(v not in (None, "") for v in row):
                records.append([cell_text(v) for v in row])
            if len(records) > MAX_ROWS + 1:
                raise ApiError(413, "too_many_rows")
    except (zipfile.BadZipFile, KeyError, IndexError, ValueError, OSError):
        raise invalid() from None
    if len(records) < 2:
        raise invalid()
    return table(records[0], records[1:])


def parse_1c(data):
    text = decode(data)
    lines = [line.strip() for line in text.splitlines()]
    if not lines or lines[0] != "1CClientBankExchange":
        raise invalid()
    header, docs, current = {}, [], None
    for line in lines[1:]:
        if line.startswith("СекцияДокумент"):
            current = {}
        elif line == "КонецДокумента":
            if current is not None:
                docs.append(current)
            current = None
        elif "=" in line:
            key, _, value = line.partition("=")
            (header if current is None else current)[key.strip()] = value.strip()
    body = []
    for doc in docs:
        own = doc.get("РасчСчет") or header.get("РасчСчет") or ""
        payer, payee = doc.get("ПлательщикСчет", ""), doc.get("ПолучательСчет", "")
        if own and payee == own:
            direction, counterparty = "in", doc.get("Плательщик1") or doc.get("Плательщик", "")
        elif own and payer == own:
            direction, counterparty = "out", doc.get("Получатель1") or doc.get("Получатель", "")
        else:
            direction, counterparty = "", doc.get("Получатель") or doc.get("Плательщик", "")
        body.append([doc.get("Дата", ""), doc.get("Сумма", ""), direction, counterparty, doc.get("НазначениеПлатежа", "")])
    return table(FIXED_COLUMNS, body)


def local(tag):
    return tag.rsplit("}", 1)[-1]


def child_text(node, *path):
    for name in path:
        node = next((c for c in node if local(c.tag) == name), None)
        if node is None:
            return ""
    return (node.text or "").strip()


def parse_commerceml(data):
    # DTD/сущности не нужны выгрузкам 1С — отсекаем (XXE, billion laughs).
    if re.search(rb"<!(DOCTYPE|ENTITY)", data, re.I):
        raise invalid()
    try:
        root = ElementTree.fromstring(data)
    except ElementTree.ParseError:
        raise invalid() from None
    if local(root.tag) != "КоммерческаяИнформация":
        raise invalid()
    body = []
    for doc in (n for n in root if local(n.tag) == "Документ"):
        client = child_text(doc, "Контрагенты", "Контрагент", "Наименование")
        note = " ".join(p for p in (f"Заказ {child_text(doc, 'Номер')}".strip(), child_text(doc, "Комментарий")) if p)
        body.append([child_text(doc, "Дата"), child_text(doc, "Сумма"), "in", client, note])
    # Каталог товаров/предложения не содержат денежных операций — только заказы.
    return table(FIXED_COLUMNS, body)


PARSERS = {"csv": parse_csv, "xlsx": parse_xlsx, "1c_bank": parse_1c, "commerceml": parse_commerceml}
FIXED_KINDS = {"1c_bank", "commerceml"}


def detect_kind(filename, data):
    name = filename.lower()
    if name.endswith(".xlsx"):
        return "xlsx"
    if name.endswith(".csv"):
        return "csv"
    if name.endswith(".xml"):
        return "commerceml"
    if data.lstrip()[:1] == b"<":
        return "commerceml"
    if b"1CClientBankExchange" in data[:200]:
        return "1c_bank"
    if name.endswith(".txt"):
        return "1c_bank"
    return "csv"
