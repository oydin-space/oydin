from datetime import timedelta

from django.db.models import Sum
from django.utils import timezone

from accounts.access import FINANCE_READERS
from accounts.models import Membership
from finance import services as fin
from finance.models import Obligation, Transaction
from people.models import Person
from people.services import active_q

WINDOW_DAYS = 30
MONEY_KEYS = ("net_uzs", "inflow_30d_uzs", "outflow_30d_uzs", "receivable_uzs", "payable_uzs", "headcount")


def _headcount(business, today):
    """Активные сотрудники и подрядчики; покупатели и партнёры не штат."""
    return Person.objects.filter(
        active_q(today), business=business, kind__in=(Person.Kind.STAFF, Person.Kind.CONTRACTOR)
    ).count()


def business_row(membership, today):
    business = membership.business
    since = today - timedelta(days=WINDOW_DAYS)
    flows = fin.confirmed(business).filter(purpose=Transaction.Purpose.BUSINESS, date__gt=since, date__lte=today)
    open_obl = Obligation.objects.filter(business=business).exclude(status=Obligation.Status.PAID)
    owed = open_obl.filter(kind=Obligation.Kind.RECEIVABLE).aggregate(s=Sum("amount"))["s"] or 0
    owe = open_obl.exclude(kind=Obligation.Kind.RECEIVABLE).aggregate(s=Sum("amount"))["s"] or 0
    return {
        "id": business.id,
        "name": business.name,
        "role": membership.role,
        "is_demo": business.is_demo,
        "net_uzs": fin.balance_uzs(business),
        "inflow_30d_uzs": fin.uzs(flows.filter(direction=Transaction.Direction.IN)),
        "outflow_30d_uzs": fin.uzs(flows.filter(direction=Transaction.Direction.OUT)),
        "receivable_uzs": owed,
        "payable_uzs": owe,
        "headcount": _headcount(business, today),
    }


def rollup(user):
    """Только бизнесы, где пользователь owner/accountant; seller деньги не видит."""
    today = timezone.localdate()
    memberships = Membership.objects.filter(user=user, role__in=FINANCE_READERS).select_related("business").order_by("business__name", "id")
    rows = [business_row(m, today) for m in memberships]
    totals = {k: sum(r[k] for r in rows) for k in MONEY_KEYS}
    return {"businesses": rows, "totals": totals, "window_days": WINDOW_DAYS}
