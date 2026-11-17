from django.http import HttpResponse
from django.utils import timezone

from accounts.http import ApiError, api_view, json_response, parse_json

from . import services as svc
from .models import Obligation, Transaction
from .validation import parse_amount, parse_date, transaction_fields

OBLIGATION_KINDS = {c for c, _ in Obligation.Kind.choices}


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
def pulse(request):
    return json_response(svc.pulse(request.business))


@api_view("GET")
def accounts(request):
    return json_response({"items": svc.list_accounts(request.business)})


@api_view("GET", "POST")
def transactions(request):
    business = request.business
    if request.method == "POST":
        body = parse_json(request)
        fields = transaction_fields(body, business, partial=False)
        fields.setdefault("date", timezone.localdate())
        tx = Transaction.objects.create(
            business=business, status=Transaction.Status.CONFIRMED, source=Transaction.Source.MANUAL, **fields
        )
        tx = svc.merge_transfer(tx)
        return json_response(svc.serialize_transaction(tx), status=201)
    qs = Transaction.objects.filter(business=business)
    status = request.GET.get("status")
    if status:
        if status not in {"draft", "confirmed"}:
            raise ApiError(400, "status: draft или confirmed")
        qs = qs.filter(status=status)
    purpose = request.GET.get("purpose")
    if purpose:
        if purpose not in {"business", "personal", "unclear"}:
            raise ApiError(400, "purpose: business, personal или unclear")
        qs = qs.filter(purpose=purpose)
    qs = svc.search_transactions(qs, request.GET.get("q", ""))
    limit = int_param(request, "limit", 50, 200)
    return json_response({"items": [svc.serialize_transaction(t) for t in qs[:limit]]})


@api_view("PATCH", "DELETE")
def transaction_detail(request, id):
    tx = Transaction.objects.filter(pk=id, business=request.business).first()
    if tx is None:
        raise ApiError(404, "Операция не найдена")
    if request.method == "DELETE":
        tx.delete()
        return HttpResponse(status=204)
    fields = transaction_fields(parse_json(request), request.business, partial=True)
    for key, value in fields.items():
        setattr(tx, key, value)
    if tx.direction != "transfer":
        tx.transfer_account = None
    # Человек поправил и сохранил черновик ИИ — это и есть подтверждение.
    tx.status = Transaction.Status.CONFIRMED
    tx.save()
    return json_response(svc.serialize_transaction(tx))


@api_view("GET", "POST")
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
def envelopes(request):
    return json_response({"items": svc.envelopes(request.business)})


@api_view("GET")
def forecast(request):
    days = int_param(request, "days", 30, 90)
    return json_response({"points": svc.forecast_points(request.business, days)})


@api_view("GET")
def products(request):
    return json_response({"items": svc.products(request.business)})


@api_view("GET")
def orders(request):
    return json_response({"items": svc.orders(request.business)})


@api_view("GET")
def analytics_summary(request):
    period = request.GET.get("period", "month")
    if period not in svc.PERIOD_DAYS:
        raise ApiError(400, "period: week, month или quarter")
    return json_response(svc.analytics(request.business, period))
