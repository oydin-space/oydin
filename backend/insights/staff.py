"""Инсайты по команде: людей (people.Person, kind=staff) сопоставляем с подтверждёнными операциями.

Только расчёт по данным владельца: нет людей с месячной ставкой или нет выручки — карточки нет, цифры не выдумываем.
Зарплатная нагрузка = сумма месячных ставок действующих сотрудников / выручка за последние 30 дней.
Пороги 30% и 45% — ориентир для малого бизнеса, не норматив; в карточке они названы прямо."""

from datetime import timedelta
from decimal import Decimal

from django.db.models import Q

from finance import services as fin
from finance.models import Transaction
from finance.rates import MINOR_UNITS, RateUnavailable, to_uzs
from finance.texts import money
from people.models import Person
from planning.services import afford, envelopes_saved, tax_reserve_amount

WINDOW = 30
WATCH_SHARE = 30
RISK_SHARE = 45
TREND_MIN_PCT = 10

T = {
    "share_title": {
        "ru": "На зарплаты уходит {pct}% выручки",
        "uz": "Maoshlarga daromadning {pct}% ketmoqda",
        "en": "Payroll takes {pct}% of revenue",
    },
    "share_body": {
        "ru": "Формула: ставки {n} сотрудников в месяц ÷ выручка за 30 дней = {pay} ÷ {rev} = {pct}%. Ориентир: до {watch}% спокойно, выше {risk}% — зарплаты съедают запас.",
        "uz": "Formula: {n} xodimning oylik stavkalari ÷ 30 kunlik daromad = {pay} ÷ {rev} = {pct}%. Mezon: {watch}% gacha xotirjam, {risk}% dan yuqori — maoshlar zaxirani yeydi.",
        "en": "Formula: monthly rates of {n} staff ÷ revenue over 30 days = {pay} ÷ {rev} = {pct}%. Rule of thumb: up to {watch}% is comfortable, above {risk}% payroll eats your cushion.",
    },
    "share_action": {
        "ru": "Много ли я трачу на зарплаты?",
        "uz": "Maoshlarga koʻp sarflayapmanmi?",
        "en": "Am I spending too much on payroll?",
    },
    "head_title": {
        "ru": "Выручка на сотрудника — {a} в месяц",
        "uz": "Bir xodimga daromad — oyiga {a}",
        "en": "Revenue per staff member — {a} a month",
    },
    "head_body": {
        "ru": "Формула: выручка за 30 дней ÷ число действующих сотрудников = {rev} ÷ {n} = {a}. Считаются только люди с типом «сотрудник» без даты ухода.",
        "uz": "Formula: 30 kunlik daromad ÷ amaldagi xodimlar soni = {rev} ÷ {n} = {a}. Faqat «xodim» turidagi, ketgan sanasi yoʻq kishilar hisoblanadi.",
        "en": "Formula: revenue over 30 days ÷ number of current staff = {rev} ÷ {n} = {a}. Only people of type “staff” without an end date are counted.",
    },
    "head_action": {
        "ru": "Как повысить выручку на сотрудника?",
        "uz": "Bir xodimga daromadni qanday oshirish mumkin?",
        "en": "How can I raise revenue per staff member?",
    },
    "trend_up_title": {
        "ru": "Выручка на сотрудника выросла на {pct}% за 3 месяца",
        "uz": "Bir xodimga daromad 3 oyda {pct}% oshdi",
        "en": "Revenue per staff member grew {pct}% over 3 months",
    },
    "trend_down_title": {
        "ru": "Выручка на сотрудника упала на {pct}% за 3 месяца",
        "uz": "Bir xodimga daromad 3 oyda {pct}% kamaydi",
        "en": "Revenue per staff member fell {pct}% over 3 months",
    },
    "trend_body": {
        "ru": "Три окна по 30 дней (от старого к новому), выручка ÷ сотрудники на конец окна: {a} → {b} → {c}. Рост = нагрузка на людей выше, спад = людей больше, чем продаж.",
        "uz": "30 kunlik uchta oyna (eskidan yangiga), daromad ÷ oyna oxiridagi xodimlar: {a} → {b} → {c}. Oʻsish — odamlarga yuk koʻp, pasayish — odam savdodan koʻp.",
        "en": "Three 30-day windows (oldest to newest), revenue ÷ staff at the window end: {a} → {b} → {c}. Rising means more load per person, falling means more people than sales.",
    },
    "trend_action": {
        "ru": "Справляется ли команда с нагрузкой?",
        "uz": "Jamoa yuk bilan eplayaptimi?",
        "en": "Is the team coping with the load?",
    },
    "risk_title": {
        "ru": "Зарплаты выше безопасной доли — новых людей лучше не брать",
        "uz": "Maoshlar xavfsiz ulushdan yuqori — yangi odam olmagan maʼqul",
        "en": "Payroll is above the safe share — hold off on hiring",
    },
    "risk_body": {
        "ru": "Зарплаты {pay} в месяц — это {pct}% выручки за 30 дней ({rev}), выше ориентира {risk}%. Ещё один сотрудник на {hire} в месяц поднял бы долю до {after}%.",
        "uz": "Maoshlar oyiga {pay} — bu 30 kunlik daromadning ({rev}) {pct}% i, mezon {risk}% dan yuqori. Oyiga {hire}lik yana bir xodim ulushni {after}% ga oshirardi.",
        "en": "Payroll is {pay} a month — {pct}% of revenue over 30 days ({rev}), above the {risk}% guide. One more hire at {hire} a month would lift it to {after}%.",
    },
    "yes_title": {
        "ru": "Ещё одного сотрудника за {hire} в месяц можно потянуть",
        "uz": "Oyiga {hire}lik yana bir xodimni koʻtarish mumkin",
        "en": "You can afford one more hire at {hire} a month",
    },
    "yes_body": {
        "ru": "Берём среднюю ставку {hire} и проверяем её прогнозом на ближайшие 30 дней: остаток не опускается ниже {low} ({d}), резерв налогов и конвертов — {buf}. Доля зарплат после найма — {after}% выручки. Проверка только на 30 дней вперёд.",
        "uz": "Oʻrtacha stavka {hire} ni keyingi 30 kunlik prognozda tekshiramiz: qoldiq {low} dan ({d}) pastga tushmaydi, soliq va konvertlar zaxirasi — {buf}. Yollashdan keyin maoshlar ulushi — daromadning {after}%. Tekshiruv faqat 30 kun oldinga.",
        "en": "We take the average rate {hire} and run it through the next 30 days of your forecast: the balance stays at or above {low} ({d}), tax and envelope reserve is {buf}. Payroll share after hiring would be {after}% of revenue. The check covers 30 days ahead only.",
    },
    "wait_title": {
        "ru": "Ещё один сотрудник за {hire} в месяц — пока впритык",
        "uz": "Oyiga {hire}lik yana bir xodim — hozircha qiyin",
        "en": "One more hire at {hire} a month is tight for now",
    },
    "wait_body": {
        "ru": "Прогноз на 30 дней с ещё одной ставкой {hire}: {explanation} Доля зарплат после найма — {after}% выручки.",
        "uz": "Yana bir {hire} stavka bilan 30 kunlik prognoz: {explanation} Yollashdan keyin maoshlar ulushi — daromadning {after}%.",
        "en": "30-day forecast with one more rate of {hire}: {explanation} Payroll share after hiring would be {after}% of revenue.",
    },
    "headroom_action": {
        "ru": "Могу ли я позволить себе нового сотрудника?",
        "uz": "Yangi xodim olishga qurbim yetadimi?",
        "en": "Can I afford a new hire?",
    },
    "source": {
        "ru": "Люди из раздела «Команда» и ваши подтверждённые операции",
        "uz": "«Jamoa» boʻlimidagi odamlar va tasdiqlangan operatsiyalaringiz",
        "en": "People from the Team section and your confirmed transactions",
    },
    "source_afford": {
        "ru": "Команда, подтверждённые операции и прогноз Oydin",
        "uz": "Jamoa, tasdiqlangan operatsiyalar va Oydin prognozi",
        "en": "Team, confirmed transactions and the Oydin forecast",
    },
}


def tr(key, lang, **kw):
    return T[key][lang].format(**kw)


def _active(business, day):
    """Сотрудники, действующие на дату day (нет даты начала — считаем действующим)."""
    return Person.objects.filter(business=business, kind=Person.Kind.STAFF).filter(
        Q(started_on__isnull=True) | Q(started_on__lte=day), Q(ended_on__isnull=True) | Q(ended_on__gt=day)
    )


def _monthly_uzs(person):
    """Месячная ставка в сумах; None — ставка не месячная или валюту не пересчитать."""
    if person.pay_type != Person.PayType.MONTHLY or not person.pay_amount:
        return None
    if person.currency not in MINOR_UNITS:
        return None
    minor = int((person.pay_amount * MINOR_UNITS[person.currency]).quantize(Decimal(1)))
    return to_uzs(minor, person.currency)


def _revenue(business, start, end):
    qs = fin.confirmed(business).filter(
        direction=Transaction.Direction.IN, purpose=Transaction.Purpose.BUSINESS, date__gt=start, date__lte=end
    )
    return fin.uzs(qs)


def _card(card_id, tone, title, body, now, lang, action, source="source", confidence="medium"):
    return {
        "id": card_id, "kind": "own", "title": title, "body": body, "tone": tone,
        "source": tr(source, lang), "source_url": None, "as_of": now, "confidence": confidence, "action": action,
    }


def _payroll(business, now):
    """(месячный фонд, число людей с месячной ставкой, средняя ставка) или None, если считать нечего/нельзя."""
    rates = []
    for person in _active(business, now):
        rate = _monthly_uzs(person)
        if rate is None:
            if person.pay_type == Person.PayType.MONTHLY and person.pay_amount:
                return None  # валюта без курса: частичная сумма была бы ложью
            continue
        rates.append(rate)
    if not rates:
        return None
    return sum(rates), len(rates), sum(rates) // len(rates)


def staff_insights(business, now=None, lang="ru"):
    now = now or fin.today()
    items = []

    headcount = _active(business, now).count()
    revenue = _revenue(business, now - timedelta(days=WINDOW), now)

    if headcount and revenue > 0:
        per_head = revenue // headcount
        items.append(_card(
            "staff-revenue-per-head", "calm",
            tr("head_title", lang, a=money(per_head, lang)),
            tr("head_body", lang, rev=money(revenue, lang), n=headcount, a=money(per_head, lang)), now, lang,
            tr("head_action", lang)))

    # Тренд: выручка на человека в трёх 30-дневных окнах, штат — на конец каждого окна.
    series = []
    for i in (2, 1, 0):
        end = now - timedelta(days=WINDOW * i)
        n = _active(business, end).count()
        rev = _revenue(business, end - timedelta(days=WINDOW), end)
        if not n or rev <= 0:
            series = None
            break
        series.append(rev // n)
    if series and series[0] > 0:
        pct = round((series[2] - series[0]) / series[0] * 100)
        if abs(pct) >= TREND_MIN_PCT:
            title_key = "trend_up_title" if pct > 0 else "trend_down_title"
            items.append(_card(
                "staff-load-trend", "watch" if pct < 0 else "calm",
                tr(title_key, lang, pct=abs(pct)),
                tr("trend_body", lang, a=money(series[0], lang), b=money(series[1], lang), c=money(series[2], lang)),
                now, lang, tr("trend_action", lang)))

    payroll = _payroll(business, now)
    if payroll and revenue > 0:
        pay, n, hire = payroll
        share = round(pay / revenue * 100)
        after = round((pay + hire) / revenue * 100)
        tone = "risk" if share > RISK_SHARE else ("watch" if share > WATCH_SHARE else "calm")
        items.append(_card(
            "staff-payroll-share", tone,
            tr("share_title", lang, pct=share),
            tr("share_body", lang, n=n, pay=money(pay, lang), rev=money(revenue, lang), pct=share,
               watch=WATCH_SHARE, risk=RISK_SHARE), now, lang, tr("share_action", lang)))

        if share > RISK_SHARE:
            items.append(_card(
                "staff-hire-headroom", "risk", tr("risk_title", lang),
                tr("risk_body", lang, pay=money(pay, lang), pct=share, rev=money(revenue, lang), risk=RISK_SHARE,
                   hire=money(hire, lang), after=after), now, lang, tr("headroom_action", lang)))
        else:
            try:
                verdict = afford(business, hire, "UZS", day=now, title="hire", recurring="monthly", now=now, lang=lang)
            except RateUnavailable:
                verdict = None
            if verdict:
                if verdict["verdict"] == "yes":
                    buffer = tax_reserve_amount(business, now) + envelopes_saved(business)
                    title = tr("yes_title", lang, hire=money(hire, lang))
                    body = tr("yes_body", lang, hire=money(hire, lang), low=money(verdict["min_balance_after"], lang),
                              d=verdict["min_balance_date"], buf=money(buffer, lang), after=after)
                    tone = "calm"
                else:
                    title = tr("wait_title", lang, hire=money(hire, lang))
                    body = tr("wait_body", lang, hire=money(hire, lang), explanation=verdict["explanation"], after=after)
                    tone = "watch"
                items.append(_card("staff-hire-headroom", tone, title, body, now, lang, tr("headroom_action", lang),
                                   source="source_afford"))
    return items
