"""PDF плана начинающего: reportlab и шрифты из sharing (без новых зависимостей)."""

from io import BytesIO
from xml.sax.saxutils import escape

from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from sharing.pdf import _fonts

L = {
    "ru": {"title": "План запуска", "budget": "Бюджет запуска", "name": "Статья", "kind": "Тип", "amount": "Сумма, UZS",
           "one_off": "Разово", "monthly": "В месяц", "tot1": "Итого разово", "totm": "Итого в месяц", "none": "Статьи не заполнены.",
           "be": "Точка безубыточности", "price": "Цена за единицу", "cost": "Переменные расходы на единицу",
           "fixed": "Постоянные расходы в месяц", "formula": "Единиц в месяц = постоянные расходы ÷ (цена − переменные расходы на единицу); выручка = единицы × цена",
           "units": "Единиц в месяц", "rev": "Выручка в месяц, UZS", "nodata": "Недостаточно данных или цена не выше переменных расходов.",
           "reg": "Формы регистрации", "check": "Чек-лист", "steps": {"budget": "Составить бюджет запуска", "breakeven": "Посчитать безубыточность", "form": "Выбрать форму регистрации", "register": "Зарегистрироваться", "bank": "Открыть расчётный счёт", "soliq": "Уточнить режим и сроки в налоговой"},
           "chosen": "Выбрано"},
    "uz": {"title": "Boshlash rejasi", "budget": "Boshlash byudjeti", "name": "Modda", "kind": "Turi", "amount": "Summa, UZS",
           "one_off": "Bir martalik", "monthly": "Oylik", "tot1": "Jami bir martalik", "totm": "Jami oylik", "none": "Moddalar kiritilmagan.",
           "be": "Zararsizlik nuqtasi", "price": "Birlik narxi", "cost": "Birlikka oʻzgaruvchan xarajat",
           "fixed": "Oylik doimiy xarajatlar", "formula": "Oyiga birlik = doimiy xarajatlar ÷ (narx − birlikka oʻzgaruvchan xarajat); tushum = birlik × narx",
           "units": "Oyiga birlik", "rev": "Oylik tushum, UZS", "nodata": "Maʼlumot yetarli emas yoki narx oʻzgaruvchan xarajatdan oshmaydi.",
           "reg": "Roʻyxatdan oʻtish shakllari", "check": "Cheklist", "steps": {"budget": "Boshlash byudjetini tuzish", "breakeven": "Zararsizlikni hisoblash", "form": "Roʻyxat shaklini tanlash", "register": "Roʻyxatdan oʻtish", "bank": "Hisob raqam ochish", "soliq": "Rejim va muddatlarni soliqda aniqlash"},
           "chosen": "Tanlangan"},
    "en": {"title": "Start plan", "budget": "Startup budget", "name": "Item", "kind": "Type", "amount": "Amount, UZS",
           "one_off": "One-off", "monthly": "Monthly", "tot1": "Total one-off", "totm": "Total monthly", "none": "No items entered.",
           "be": "Break-even", "price": "Price per unit", "cost": "Variable cost per unit",
           "fixed": "Fixed costs per month", "formula": "Units per month = fixed costs ÷ (price − variable cost per unit); revenue = units × price",
           "units": "Units per month", "rev": "Revenue per month, UZS", "nodata": "Not enough data, or price is not above variable cost.",
           "reg": "Registration forms", "check": "Checklist", "steps": {"budget": "Draw up the startup budget", "breakeven": "Work out break-even", "form": "Choose a registration form", "register": "Register", "bank": "Open a bank account", "soliq": "Confirm regime and deadlines with the tax office"},
           "chosen": "Chosen"},
}


def _sum(v):
    return "—" if v is None else f"{v:,}".replace(",", " ")


def render(business_name, plan, reg, lang):
    _fonts()
    t = L[lang]
    body = ParagraphStyle("b", fontName="DejaVu", fontSize=9, leading=12)
    cell = ParagraphStyle("c", parent=body, fontSize=8, leading=10)
    h1 = ParagraphStyle("h1", parent=body, fontName="DejaVu-Bold", fontSize=15, leading=19, spaceAfter=4)
    h2 = ParagraphStyle("h2", parent=body, fontName="DejaVu-Bold", fontSize=11, leading=14, spaceBefore=10, spaceAfter=4)
    small = ParagraphStyle("s", parent=body, fontSize=7.5, leading=10)

    def table(rows, widths, right=()):
        t_ = Table(rows, colWidths=widths, repeatRows=1)
        style = [("FONTNAME", (0, 0), (-1, -1), "DejaVu"), ("FONTSIZE", (0, 0), (-1, -1), 8),
                 ("FONTNAME", (0, 0), (-1, 0), "DejaVu-Bold"), ("LINEBELOW", (0, 0), (-1, -1), 0.25, (0.8, 0.8, 0.8)),
                 ("VALIGN", (0, 0), (-1, -1), "TOP")]
        style += [("ALIGN", (c, 0), (c, -1), "RIGHT") for c in right]
        t_.setStyle(TableStyle(style))
        return t_

    items, tot, be, res = plan["budget_items"], plan["totals"], plan["breakeven"], plan["breakeven_result"]
    story = [Paragraph(escape(business_name), h1), Paragraph(t["title"], body), Paragraph(t["budget"], h2)]
    if items:
        rows = [[t["name"], t["kind"], t["amount"]]] + [[i["name"], t[i["kind"]], _sum(i["amount"])] for i in items]
        rows += [[t["tot1"], "", _sum(tot["one_off"])], [t["totm"], "", _sum(tot["monthly"])]]
        story.append(table(rows, [90 * mm, 30 * mm, 40 * mm], right=(2,)))
    else:
        story.append(Paragraph(t["none"], body))
    story += [Paragraph(t["be"], h2), table([
        [t["price"], _sum(be.get("price"))], [t["cost"], _sum(be.get("unit_cost"))], [t["fixed"], _sum(be.get("fixed_monthly"))],
        [t["units"], _sum(res["units"])], [t["rev"], _sum(res["revenue"])],
    ], [110 * mm, 50 * mm], right=(1,)), Spacer(1, 3), Paragraph(escape(t["formula"]), small)]
    if res["units"] is None:
        story.append(Paragraph(t["nodata"], small))
    story.append(Paragraph(t["reg"], h2))
    c = reg["columns"]
    rows = [[c["form"], c["who"], c["liability"], c["staff"], c["where"]]]
    for f in reg["forms"]:
        name = f["name"] + (f" ({t['chosen']})" if plan["regime"] == f["id"] else "")
        rows.append([Paragraph(escape(x), cell) for x in (name, f["who"], f["liability"], f["staff"], f["where"])])
    story += [table(rows, [28 * mm, 40 * mm, 34 * mm, 26 * mm, 32 * mm]), Spacer(1, 4),
              Paragraph(escape(reg["disclaimer"]), small),
              Paragraph(escape(reg["sources_title"] + ": " + ", ".join(s["url"] for s in reg["sources"])), small),
              Paragraph(t["check"], h2)]
    done = set(plan["checklist"])
    story += [Paragraph(("[x] " if k in done else "[ ] ") + escape(v), body) for k, v in t["steps"].items()]
    buf = BytesIO()
    SimpleDocTemplate(buf, pagesize=A4, title=f"{business_name} — {t['title']}", leftMargin=18 * mm, rightMargin=18 * mm).build(story)
    return buf.getvalue()
