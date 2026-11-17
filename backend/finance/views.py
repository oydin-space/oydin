from django.db.models import Q
from django.http import HttpResponse
from django.utils import timezone

from accounts.access import FINANCE_READERS, OWNER, SELLER, require_role
from accounts.http import ApiError, api_view, json_response, parse_json

from publicapi.services import emit

from . import rates
from . import services as svc
from .models import Account, Currency, Obligation, Transaction
from .validation import MAX_AMOUNT, PURPOSES, parse_amount, parse_date, transaction_fields

OBLIGATION_KINDS = {c for c, _ in Obligation.Kind.choices}
OWNER_PURPOSES = {"owner_draw", "owner_contribution"}


def own_transactions(request):
    """Операции бизнеса; продавец видит и правит только свои."""
    qs = Transaction.objects.filter(business=request.business)
    return qs.filter(created_by=request.user) if request.role == SELLER else qs


def _owner_purpose_only(request, fields):
    if request.role != OWNER and fields.get("purpose") in OWNER_PURPOSES:
        raise ApiError(403, "forbidden")


def int_param(request, name, default, maximum):
    raw = request.GET.get(name)
    if raw is None:
        return default
    try:
        value = int(raw)
    except ValueError:
        raise ApiError(400, f"{name} должен быть числом") from None
    return max(1, min(value, maximum))


@api_view("GET")
@require_role(*FINANCE_READERS)
def pulse(request):
    return json_response(svc.pulse(request.business))


def _account_name(body, request, exclude=None):
    name = body.get("name")
    if not isinstance(name, str) or not name.strip() or len(name.strip()) > 100:
        raise ApiError(400, "invalid_name")
    name = name.strip()
    taken = Account.objects.filter(business=request.business, name__iexact=name)
    if exclude is not None:
        taken = taken.exclude(pk=exclude.pk)
    if taken.exists():
        raise ApiError(400, "account_exists")
    return name


def _owner_account_write(request):
    if request.role != OWNER or request.business.is_demo:
        raise ApiError(403, "forbidden")


@api_view("GET", "POST")
def accounts(request):
    if request.method == "POST":
        _owner_account_write(request)
        body = parse_json(request)
        name = _account_name(body, request)
        if body.get("kind") not in {c for c, _ in Account.Kind.choices}:
            raise ApiError(400, "invalid_kind")
        if body.get("currency") not in {c for c, _ in Currency.choices}:
            raise ApiError(400, "invalid_currency")
        opening = body.get("opening_balance", 0)
        if isinstance(opening, bool) or not isinstance(opening, int) or not 0 <= opening <= MAX_AMOUNT:
            raise ApiError(400, "invalid_opening_balance")
        account = Account.objects.create(
            business=request.business, name=name, kind=body["kind"], currency=body["currency"], opening_balance=opening
        )
        return json_response(svc.serialize_account(account, opening), status=201)
    items = svc.list_accounts(request.business)
    if request.role == SELLER:
        # Продавцу нужны счета для ввода операций, но не остатки.
        items = [{k: v for k, v in a.items() if k not in ("balance", "balance_uzs")} for a in items]
    return json_response({"items": items})


@api_view("PATCH", "DELETE")
def account_detail(request, id):
    _owner_account_write(request)
    account = Account.objects.filter(pk=id, business=request.business).first()
    if account is None:
        raise ApiError(404, "Счёт не найден")
    if request.method == "DELETE":
        if Transaction.objects.filter(Q(account=account) | Q(transfer_account=account)).exists():
            raise ApiError(409, "account_in_use")
        account.delete()
        return HttpResponse(status=204)
    account.name = _account_name(parse_json(request), request, exclude=account)
    account.save(update_fields=["name"])
    return json_response(svc.serialize_account(account, svc.account_balances(request.business)[account.id]))


@api_view("GET", business=False)
def exchange_rates(request):
    return json_response(rates.serialize(rates.latest()))


@api_view("GET", "POST")
def transactions(request):
    business = request.business
    if request.method == "POST":
        body = parse_json(request)
        fields = transaction_fields(body, business, partial=False)
        _owner_purpose_only(request, fields)
        fields.setdefault("date", timezone.localdate())
        tx = Transaction.objects.create(
            business=business, status=Transaction.Status.CONFIRMED, source=Transaction.Source.MANUAL,
            created_by=request.user, **fields
        )
        if request.role != SELLER:
            tx = svc.merge_transfer(tx)
        emit("transaction.created", tx)
        return json_response(svc.serialize_transaction(tx), status=201)
    qs = own_transactions(request)
    status = request.GET.get("status")
    if status:
        if status not in {"draft", "confirmed"}:
            raise ApiError(400, "status: draft или confirmed")
        qs = qs.filter(status=status)
    purpose = request.GET.get("purpose")
    if purpose:
        if purpose not in PURPOSES:
            raise ApiError(400, "purpose: business, personal, unclear, owner_draw или owner_contribution")
        qs = qs.filter(purpose=purpose)
    qs = svc.search_transactions(qs, request.GET.get("q", ""))
    limit = int_param(request, "limit", 50, 200)
    return json_response({"items": [svc.serialize_transaction(t) for t in qs[:limit]]})


@api_view("PATCH", "DELETE")
def transaction_detail(request, id):
    tx = own_transactions(request).filter(pk=id).first()
    if tx is None:
        raise ApiError(404, "Операция не найдена")
    if request.method == "DELETE":
        tx.delete()
        return HttpResponse(status=204)
    body = parse_json(request)
    if "status" in body and body["status"] not in {s for s, _ in Transaction.Status.choices}:
        raise ApiError(400, "status: draft или confirmed")
    fields = transaction_fields(body, request.business, partial=True, instance=tx)
    _owner_purpose_only(request, fields)
    for key, value in fields.items():
        setattr(tx, key, value)
    if tx.direction != "transfer":
        tx.transfer_account = None
    was_draft = tx.status == Transaction.Status.DRAFT
    if "status" in body:
        tx.status = body["status"]
    tx.save()
    if was_draft and tx.status == Transaction.Status.CONFIRMED:
        emit("transaction.confirmed", tx)
    return json_response(svc.serialize_transaction(tx))


@api_view("GET", "POST")
@require_role(*FINANCE_READERS)
def obligations(request):
    business = request.business
    if request.method == "POST":
        body = parse_json(request)
        title = body.get("title")
        if not isinstance(title, str) or not title.strip():
            raise ApiError(400, "Нужно название")
        kind = body.get("kind")
        if kind not in OBLIGATION_KINDS:
            raise ApiError(400, "Неизвестный вид обязательства")
        obligation = Obligation.objects.create(
            business=business, title=title.strip()[:200], kind=kind,
            amount=parse_amount(body.get("amount")), due_date=parse_date(body.get("due_date")),
        )
        item = svc.obligation_dicts(business, svc.bundle(business), only_id=obligation.id)[0]
        return json_response(svc.serialize_obligation(item), status=201)
    b = svc.bundle(business)
    return json_response({"items": [svc.serialize_obligation(o) for o in svc.obligation_dicts(business, b)]})


@api_view("GET")
@require_role(*FINANCE_READERS)
def envelopes(request):
    return json_response({"items": svc.envelopes(request.business)})


@api_view("GET")
@require_role(*FINANCE_READERS)
def forecast(request):
    days = int_param(request, "days", 30, 90)
    return json_response({"points": svc.forecast_points(request.business, days)})


@api_view("GET")
def products(request):
    items = svc.products(request.business)
    if request.role == SELLER:
        for item in items:
            for key in ("unit_cost", "margin_pct", "markup_pct"):
                item.pop(key, None)
    return json_response({"items": items})


@api_view("GET")
@require_role(*FINANCE_READERS)
def orders(request):
    return json_response({"items": svc.orders(request.business)})


@api_view("GET")
@require_role(*FINANCE_READERS)
def analytics_summary(request):
    period = request.GET.get("period", "month")
    if period not in svc.PERIOD_DAYS:
        raise ApiError(400, "period: week, month или quarter")
    return json_response(svc.analytics(request.business, period))
