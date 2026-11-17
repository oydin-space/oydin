"""PDF отчёта для бухгалтера (reportlab, шрифт DejaVu с кириллицей и узбекской латиницей)."""

from io import BytesIO
from xml.sax.saxutils import escape
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

FONTS = Path(__file__).parent / "fonts"
_registered = False


def _fonts():
    global _registered
    if not _registered:
        pdfmetrics.registerFont(TTFont("DejaVu", str(FONTS / "DejaVuSans.ttf")))
        pdfmetrics.registerFont(TTFont("DejaVu-Bold", str(FONTS / "DejaVuSans-Bold.ttf")))
        _registered = True


def _sum(value):
    return f"{value:,}".replace(",", " ")


def render(report):
    _fonts()
    body = ParagraphStyle("b", fontName="DejaVu", fontSize=9, leading=12)
    h1 = ParagraphStyle("h1", parent=body, fontName="DejaVu-Bold", fontSize=15, leading=19, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=body, fontName="DejaVu-Bold", fontSize=11, leading=14, spaceBefore=10, spaceAfter=4)
    small = ParagraphStyle("s", parent=body, fontSize=7.5, leading=10)

    def table(rows, widths):
        t = Table(rows, colWidths=widths, repeatRows=1)
        t.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), "DejaVu"), ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("FONTNAME", (0, 0), (-1, 0), "DejaVu-Bold"), ("LINEBELOW", (0, 0), (-1, -1), 0.25, (0.8, 0.8, 0.8)),
            ("ALIGN", (1, 0), (-1, -1), "RIGHT"),
        ]))
        return t

    p = report["period"]
    story = [
        Paragraph(escape(report["business_name"]), h1),
        Paragraph(f"Отчёт за период {p['period_from']} — {p['period_to']} (сумы, UZS)", body),
        Paragraph(f"Сформирован: {report['generated_at']}", small),
        Paragraph("Итоги периода", h2),
        table([
            ["Показатель", "Сумма"],
            ["Выручка", _sum(p["revenue"])], ["Расходы бизнеса", _sum(p["expenses"])],
            ["Прибыль", "нет данных" if p["profit"] is None else _sum(p["profit"])],
            ["Изменение денег", _sum(p["cash_change"])],
            ["Выплаты владельцу", _sum(p["owner_draws"])], ["Вклады владельца", _sum(p["owner_contributions"])],
        ], [100 * mm, 60 * mm]),
        Paragraph("Счета", h2),
        table([["Счёт", "Остаток, UZS"]] + [[a["name"], _sum(a["balance_uzs"])] for a in report["accounts"]],
              [100 * mm, 60 * mm]),
        Paragraph("По категориям", h2),
        table([["Категория", "Приход", "Расход"]] +
              [[c["category"], _sum(c["inflow"]), _sum(c["outflow"])] for c in report["by_category"]],
              [80 * mm, 40 * mm, 40 * mm]),
        Paragraph("Обязательства", h2),
        table([["Название", "Срок", "Сумма"]] +
              [[o["title"], o["due_date"], _sum(o["amount"])] for o in report["obligations"]],
              [80 * mm, 40 * mm, 40 * mm]),
        Spacer(1, 8),
        Paragraph(report["disclaimer"], small),
    ]
    buf = BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, title=report["business_name"], leftMargin=18 * mm, rightMargin=18 * mm).build(story)
    return buf.getvalue()
