"""Выгрузка операций: XLSX, CSV, 1CClientBankExchange. Строки с =,+,-,@ экранируются (CSV/formula injection)."""

import csv
import io
from datetime import datetime

from accounts.http import ApiError
from finance.models import Transaction

MAX_ROWS = 20_000
HEADERS = ["date", "direction", "amount", "category", "counterparty", "note", "account", "purpose", "status"]
DANGEROUS = ("=", "+", "-", "@", "\t", "\r")


def safe(value):
    if isinstance(value, str) and value.startswith(DANGEROUS):
        return "'" + value
    return value


def queryset(business, start, end):
    qs = Transaction.objects.filter(business=business).select_related("account").order_by("date", "id")
    if start:
        qs = qs.filter(date__gte=start)
    if end:
        qs = qs.filter(date__lte=end)
    if qs.count() > MAX_ROWS:
        raise ApiError(400, "too_many_rows")
    return qs


def row_of(t):
    return [t.date.isoformat(), t.direction, t.amount, safe(t.category), safe(t.counterparty or ""),
            safe(t.note), safe(t.account.name), t.purpose, t.status]


def to_csv(qs):
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(HEADERS)
    for t in qs:
        writer.writerow(row_of(t))
    return ("\ufeff" + buf.getvalue()).encode("utf-8")


def to_xlsx(qs):
    from openpyxl import Workbook

    wb = Workbook(write_only=True)
    ws = wb.create_sheet("transactions")
    ws.append(HEADERS)
    for t in qs:
        ws.append(row_of(t))
    buf = io.BytesIO()
    wb.save(buf)
    return buf.getvalue()


def line(value):
    return " ".join(str(value).split())


def to_1c(qs):
    rows = list(qs)
    out = [
        "1CClientBankExchange", "ВерсияФормата=1.03", "Кодировка=Windows", "Отправитель=Oydin",
        f"ДатаСоздания={datetime.now():%d.%m.%Y}",
    ]
    if rows:
        out += [f"ДатаНачала={rows[0].date:%d.%m.%Y}", f"ДатаКонца={rows[-1].date:%d.%m.%Y}"]
    for t in rows:
        own, other = line(t.account.name), line(t.counterparty or "")
        incoming = t.direction == Transaction.Direction.IN
        out += [
            "СекцияДокумент=Платежное поручение", f"Номер={t.id}", f"Дата={t.date:%d.%m.%Y}",
            f"Сумма={t.amount}.00", f"РасчСчет={own}",
            f"ПлательщикСчет={'' if incoming else own}", f"Плательщик={other if incoming else own}",
            f"ПолучательСчет={own if incoming else ''}", f"Получатель={own if incoming else other}",
            f"НазначениеПлатежа={line(t.note) or line(t.category)}", "КонецДокумента",
        ]
    out.append("КонецФайла")
    return ("\r\n".join(out) + "\r\n").encode("cp1251", errors="replace")


RENDERERS = {
    "csv": (to_csv, "text/csv; charset=utf-8"),
    "xlsx": (to_xlsx, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
    "1c_bank": (to_1c, "text/plain; charset=windows-1251"),
}
EXTENSIONS = {"csv": "csv", "xlsx": "xlsx", "1c_bank": "txt"}
