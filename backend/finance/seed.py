"""Демо-данные «Print Lab Tashkent»: 90 дней истории и кассовый разрыв примерно на 3 млн в ближайшие недели."""

import random
from datetime import timedelta
from decimal import Decimal

from django.contrib.auth import get_user_model
from django.db import transaction

from accounts.consent import set_consent
from accounts.models import Business, Membership, Profile
from finance import services as svc
from finance.models import Account, Currency, Envelope, ExchangeRate, Obligation, Order, OrderItem, Product, Transaction

DEMO_USERNAME = "demo"
HISTORY_DAYS = 90
TARGET_GAP = 3_000_000
SUPPLIER_STEP = 15


def next_day_of_month(today, day):
    """Ближайшая дата с этим числом месяца строго после today."""
    year, month = today.year, today.month
    for _ in range(3):
        try:
            candidate = today.replace(year=year, month=month, day=day)
        except ValueError:
            candidate = None
        if candidate and candidate > today:
            return candidate
        month += 1
        if month > 12:
            year, month = year + 1, 1
    raise ValueError(day)


def monthly_dates(upcoming, back_days, today):
    """Даты ежемесячного платежа: ближайшая будущая и прошедшие в пределах back_days."""
    dates = [upcoming]
    current = upcoming
    while True:
        previous = (current.replace(day=1) - timedelta(days=1)).replace(day=current.day) if current.day <= 28 else None
        if previous is None or (today - previous).days > back_days:
            break
        dates.append(previous)
        current = previous
    return dates


@transaction.atomic
def seed_demo():
    User = get_user_model()
    Business.objects.filter(is_demo=True).delete()
    User.objects.filter(username=DEMO_USERNAME).delete()
    rng = random.Random(42)
    today = svc.today()

    user = User.objects.create(username=DEMO_USERNAME, first_name="Алишер")
    user.set_unusable_password()
    user.save()
    business = Business.objects.create(
        name="Print Lab Tashkent", industry="Печать на одежде и мерч", city="Ташкент",
        tax_regime=Business.TaxRegime.TURNOVER, is_demo=True,
    )
    Profile.objects.create(user=user, business=business)
    set_consent(user, "ai", True)  # синтетические данные
    cash = Account.objects.create(business=business, name="Наличные", kind=Account.Kind.CASH)
    card = Account.objects.create(business=business, name="Карта Uzcard", kind=Account.Kind.CARD)
    bank = Account.objects.create(business=business, name="Расчётный счёт", kind=Account.Kind.BANK)

    txs = []

    def tx(date, account, amount, direction, category, *, purpose="business", counterparty=None, note="",
           status="confirmed", source="seed", transfer_to=None):
        txs.append(Transaction(
            business=business, account=account, transfer_account=transfer_to, date=date, amount=amount,
            direction=direction, category=category, purpose=purpose, counterparty=counterparty, note=note,
            status=status, source=source,
        ))

    start = today - timedelta(days=HISTORY_DAYS - 1)
    for i in range(HISTORY_DAYS):
        day = start + timedelta(days=i)
        weekend = day.weekday() >= 5
        k = 1.25 if weekend else 1.0
        tx(day, cash, round(rng.randint(300, 500) * k) * 1000, "in", "Розница", note="Продажи за день")
        tx(day, card, round(rng.randint(400, 650) * k) * 1000, "in", "Розница", note="Оплата картой")
        tx(day, cash, rng.choice([60, 70, 80, 90]) * 1000, "out", "Транспорт", note="Курьер, доставка")
        if day.weekday() in (1, 4):
            tx(day, cash, rng.randint(15, 25) * 10_000, "out", "Продукты", purpose="personal", note="Продукты домой")
        if rng.random() < 0.5:
            tx(day, cash, rng.choice([25, 30, 35, 40]) * 1000, "out", "Кофе", purpose="personal", note="Кофе")
        if day.weekday() == 0:
            tx(day, cash, 2_000_000, "transfer", "Перевод между счетами", note="Сдал наличные в банк", transfer_to=bank)
        if day.weekday() == 2:
            tx(day, card, 1_500_000, "transfer", "Перевод между счетами", note="Вывод с карты на счёт", transfer_to=bank)
        if day.day == 12:
            tx(day, bank, 800_000, "out", "Коммунальные", note="Свет, интернет")
        if day.day in (6, 21):
            tx(day, card, 600_000, "out", "Реклама", counterparty="Instagram Ads", note="Таргет")
        if day.day == 25:
            tx(day, card, 900_000, "out", "Одежда", purpose="personal", note="Личная покупка")

    # Регулярные платежи: прошедшие — оплаченные операции, ближайший — запланированный.
    schedule = [
        ("Аренда помещения", "rent", "Аренда", 6_000_000, next_day_of_month(today, 5), "ООО «Тошкент Бизнес Центр»"),
        ("Зарплата сотрудникам", "salary", "Зарплата", 15_000_000, next_day_of_month(today, 10), None),
        ("Платёж по кредиту", "loan", "Кредит", 3_000_000, next_day_of_month(today, 15), "Банк"),
        ("Налог (оборотный)", "tax", "Налоги", 1_100_000, next_day_of_month(today, 20), "Налоговая"),
    ]
    obligations = []
    for title, kind, category, amount, upcoming, who in schedule:
        for due in monthly_dates(upcoming, HISTORY_DAYS, today):
            if due > today:
                obligations.append(Obligation(business=business, title=title, kind=kind, amount=amount, due_date=due))
            elif due >= start:
                obligations.append(Obligation(business=business, title=title, kind=kind, amount=amount, due_date=due, status="paid"))
                tx(due, bank, amount, "out", category, counterparty=who, note=title)
    supplier_next = today + timedelta(days=8)
    for k in range(0, 7):
        due = supplier_next - timedelta(days=SUPPLIER_STEP * k)
        if due < start:
            break
        if due > today:
            obligations.append(Obligation(business=business, title="Закупка заготовок", kind="supplier", amount=5_500_000, due_date=due))
        else:
            obligations.append(Obligation(business=business, title="Закупка заготовок", kind="supplier", amount=5_500_000, due_date=due, status="paid"))
            tx(due, bank, 5_500_000, "out", "Поставщик", counterparty="Текстиль Опт", note="Футболки, кепки, шопперы")
    Obligation.objects.bulk_create(obligations)

    # Заказы и товары.
    tee = Product.objects.create(business=business, name="Футболка с принтом", price=110_000, unit_cost=60_000, cost_is_estimate=True)
    cap = Product.objects.create(business=business, name="Кепка с вышивкой", price=40_000, unit_cost=15_000, cost_is_estimate=True)
    shopper = Product.objects.create(business=business, name="Шоппер", price=70_000, unit_cost=28_000, cost_is_estimate=True)

    def order(client, channel, status, due, prepaid, lines):
        total = sum(q * p for _, q, p in lines)
        o = Order.objects.create(business=business, client=client, channel=channel, total=total, prepaid=prepaid, status=status, due_date=due)
        OrderItem.objects.bulk_create([OrderItem(order=o, product=pr, qty=q, price=p) for pr, q, p in lines])
        return o

    order("ООО «Грин Тревел»", "b2b", "production", today + timedelta(days=24), 4_500_000, [(tee, 100, 150_000)])
    order("Школа №110", "b2b", "brief", today + timedelta(days=40), 0, [(shopper, 200, 40_000)])
    past = [
        ("Кафе «Чайхона №1»", "b2b", 38, [(shopper, 60, 45_000)]),
        ("Mega Planet", "b2b", 21, [(cap, 120, 42_000)]),
        ("Интернет-магазин", "online", 9, [(tee, 25, 110_000)]),
    ]
    for client, channel, ago, lines in past:
        due = today - timedelta(days=ago)
        o = order(client, channel, "paid", due, 0, lines)
        tx(due, bank, o.total, "in", "Оплата заказа", counterparty=client, note=f"Оплата заказа: {client}")
    tx(today - timedelta(days=10), bank, 4_500_000, "in", "Предоплата заказа", counterparty="ООО «Грин Тревел»",
       note="Предоплата 30% — 100 футболок")

    # Черновики (голос/чат ещё не подтверждены).
    tx(today, cash, 60_000, "out", "Транспорт", purpose="unclear", note="Такси", status="draft", source="voice")
    tx(today - timedelta(days=1), cash, 1_200_000, "out", "Поставщик", purpose="unclear", counterparty="Текстиль Опт",
       note="Нитки и плёнка для печати", status="draft", source="chat")

    Transaction.objects.bulk_create(txs)

    # Остатки: счета не уходят в минус, а общий остаток подбирается так, чтобы разрыв был ~3 млн.
    for account, balance in svc.account_balances(business).items():
        if balance < 0:
            Account.objects.filter(pk=account).update(opening_balance=-balance)
    b = svc.bundle(business, 30, today)
    low = min(p.balance for p in b.points)
    bank.refresh_from_db()
    Account.objects.filter(pk=bank.pk).update(opening_balance=bank.opening_balance - TARGET_GAP - low)

    rent = next(o for o in obligations if o.kind == "rent" and o.status == "planned")
    salary = next(o for o in obligations if o.kind == "salary" and o.status == "planned")
    tax = next(o for o in obligations if o.kind == "tax" and o.status == "planned")
    supplier = next(o for o in obligations if o.kind == "supplier" and o.status == "planned")
    Envelope.objects.bulk_create([
        Envelope(business=business, title="Аренда", target=rent.amount, saved=2_500_000, due_date=rent.due_date),
        Envelope(business=business, title="Зарплата", target=salary.amount, saved=4_000_000, due_date=salary.due_date),
        Envelope(business=business, title="Налог", target=tax.amount, saved=tax.amount, due_date=tax.due_date),
        Envelope(business=business, title="Поставщик", target=supplier.amount, saved=0, due_date=supplier.due_date),
    ])
    seed_second_business(user, today)
    return user


# Резервный курс, если cbu.uz ещё ни разу не отвечал: seed не ходит в сеть, stale=true покажет, что курс не с ЦБ.
FALLBACK_USD_RATE = Decimal("12650.00")


def seed_second_business(user, today):
    """Второй небольшой демо-бизнес с долларовым счётом — для переключения бизнесов и мультивалютности."""
    if not ExchangeRate.objects.filter(currency=Currency.USD).exists():
        ExchangeRate.objects.create(date=today, currency=Currency.USD, rate=FALLBACK_USD_RATE, source="seed")
    cafe = Business.objects.create(
        name="Chorsu Coffee", industry="Кофейня", city="Ташкент",
        tax_regime=Business.TaxRegime.TURNOVER, is_demo=True,
    )
    Membership.objects.create(user=user, business=cafe, role="owner")
    cash = Account.objects.create(business=cafe, name="Касса", kind=Account.Kind.CASH, opening_balance=3_000_000)
    usd = Account.objects.create(
        business=cafe, name="Валютный счёт", kind=Account.Kind.BANK, currency=Currency.USD, opening_balance=150_000,
    )
    rows = [
        (cash, 1, 1_850_000, "in", "Продажи"),
        (cash, 2, 2_100_000, "in", "Продажи"),
        (cash, 3, 900_000, "out", "Кофе и молоко"),
        (usd, 5, 42_000, "out", "Кофемашина в рассрочку"),
        (cash, 7, 1_500_000, "out", "Аренда"),
    ]
    Transaction.objects.bulk_create([
        Transaction(business=cafe, account=account, date=today - timedelta(days=ago), amount=amount,
                    direction=direction, category=category, source="seed", created_by=user)
        for account, ago, amount, direction, category in rows
    ])
