import re
from datetime import timedelta
from decimal import Decimal

from django.http import HttpResponse
from django.utils import timezone

from accounts.access import ACCOUNTANT, FINANCE_READERS, OWNER, require_role
from accounts.http import ApiError, api_view, json_response, parse_json
from finance import services as fin
from finance.models import Account
from finance.validation import MAX_AMOUNT, parse_amount, parse_date

from . import services as svc
from .texts import resolve_lang
from .models import CashClose, Commitment, DebtorReminder, Goal, TaxReminder, TaxReserve

PERCENT_RE = re.compile(r"^[0-9]{1,2}(\.[0-9]{1,2})?$")


def get_or_404(model, request, id, label):
    obj = model.objects.filter(pk=id, business=request.business).first()
    if obj is None:
        raise ApiError(404, f"{label} не найден")
    return obj


def non_negative(value, label="Сумма"):
    if isinstance(value, bool) or not isinstance(value, int) or not 0 <= value <= MAX_AMOUNT:
        raise ApiError(400, f"{label} должна быть целым числом не меньше нуля")
    return value


def text_field(value, label, limit, required=True):
    if not isinstance(value, str) or (required and not value.strip()) or len(value) > limit:
        raise ApiError(400, f"{label}: строка до {limit} символов")
    return value.strip()


def choice(value, options, label):
    if value not in options:
        raise ApiError(400, f"{label}: {', '.join(options)}")
    return value


# ------------------------------------------------------------------ afford

@api_view("POST")
@require_role(*FINANCE_READERS)
def afford(request):
    body = parse_json(request)
    currency = choice(body.get("currency"), ("UZS", "USD"), "currency")
    amount = parse_amount(body.get("amount"))
    day = parse_date(body["date"]) if body.get("date") is not None else None
    title = text_field(body.get("title", ""), "title", 120, required=False)
    recurring = body.get("recurring")
    if recurring is not None:
        choice(recurring, ("weekly", "monthly"), "recurring")
    return json_response(svc.afford(request.business, amount, currency, day, title, recurring,
                                         lang=resolve_lang(request, body)))


# ------------------------------------------------------------------ cash close

def account_for(request, raw):
    account = Account.objects.filter(pk=raw if isinstance(raw, int) and not isinstance(raw, bool) else None,
                                     business=request.business).first()
    if account is None:
        raise ApiError(404, "Счёт не найден")
    return account


def parse_day(raw, default=None):
    day = parse_date(raw) if raw is not None else default
    return day


@api_view("GET", "POST")
@require_role(*FINANCE_READERS)
def cash_close(request):
    business = request.business
    if request.method == "GET":
        qs = CashClose.objects.filter(business=business)
        if request.GET.get("from"):
            qs = qs.filter(date__gte=parse_date(request.GET["from"]))
        if request.GET.get("to"):
            qs = qs.filter(date__lte=parse_date(request.GET["to"]))
        if request.GET.get("account_id"):
            try:
                qs = qs.filter(account_id=int(request.GET["account_id"]))
            except ValueError:
                raise ApiError(400, "account_id должен быть числом") from None
        return json_response({"items": [svc.serialize_close(c) for c in qs]})
    body = parse_json(request)
    key = request.headers.get("Idempotency-Key") or None
    if key and len(key) > 80:
        raise ApiError(400, "Idempotency-Key слишком длинный")
    day = parse_day(body.get("date"), timezone.localdate())
    if day > timezone.localdate():
        raise ApiError(400, "Нельзя закрыть день в будущем")
    account = account_for(request, body.get("account_id")) if "account_id" in body else None
    if account is None:
        raise ApiError(400, "Нужен account_id")
    counted = non_negative(body.get("counted"), "counted")
    note = text_field(body.get("note", ""), "note", 500, required=False)
    if key:
        previous = CashClose.objects.filter(business=request.business, idempotency_key=key).first()
        if previous:
            if (previous.account_id, previous.date, previous.counted, previous.note) != (account.id, day, counted, note):
                raise ApiError(409, "idempotency_conflict")
            return json_response(svc.serialize_close(previous))
    if CashClose.objects.filter(account=account, date=day).exists():
        raise ApiError(409, "already_closed")
    expected = svc.expected_balance(account, day)
    close = CashClose.objects.create(
        business=request.business, account=account, date=day, currency=account.currency, expected=expected,
        counted=counted, difference=counted - expected, note=note, idempotency_key=key, created_by=request.user,
    )
    return json_response(svc.serialize_close(close), status=201)


@api_view("GET")
@require_role(*FINANCE_READERS)
def cash_close_expected(request):
    raw = request.GET.get("account_id")
    try:
        account_id = int(raw)
    except (TypeError, ValueError):
        raise ApiError(400, "account_id обязателен") from None
    account = account_for(request, account_id)
    day = parse_day(request.GET.get("date"), timezone.localdate())
    return json_response({"account_id": account.id, "date": day.isoformat(), "currency": account.currency,
                          "expected": svc.expected_balance(account, day)})


@api_view("PATCH")
@require_role(*FINANCE_READERS)
def cash_close_detail(request, id):
    close = get_or_404(CashClose, request, id, "Сверка")
    body = parse_json(request)
    if "counted" in body:
        close.counted = non_negative(body["counted"], "counted")
        close.difference = close.counted - close.expected
    if "note" in body:
        close.note = text_field(body["note"], "note", 500, required=False)
    close.save()
    return json_response(svc.serialize_close(close))


# ------------------------------------------------------------------ period report

@api_view("GET")
@require_role(*FINANCE_READERS)
def period_report(request):
    today = timezone.localdate()
    start = parse_day(request.GET.get("from"), today.replace(day=1))
    end = parse_day(request.GET.get("to"), today)
    if start > end:
        raise ApiError(400, "from не может быть позже to")
    return json_response(svc.period_result(request.business, start, end))


# ------------------------------------------------------------------ tax

@api_view("GET", "PUT")
@require_role(*FINANCE_READERS)
def tax_reserve(request):
    if request.method == "PUT":
        body = parse_json(request)
        if not isinstance(body.get("enabled"), bool):
            raise ApiError(400, "enabled: true или false")
        method = choice(body.get("method"), ("fixed", "percent"), "method")
        period = choice(body.get("period"), ("month", "quarter"), "period")
        fixed, percent = body.get("fixed_amount"), body.get("percent")
        if method == "fixed":
            fixed, percent = non_negative(fixed, "fixed_amount"), None
        else:
            if not isinstance(percent, str) or not PERCENT_RE.match(percent):
                raise ApiError(400, "percent: строка вида 4 или 12.5")
            percent, fixed = Decimal(percent), None
        confirmed = body.get("confirmed_amount")
        if confirmed is not None:
            confirmed = non_negative(confirmed, "confirmed_amount")
        categories = body.get("base_categories", [])
        if not isinstance(categories, list) or not all(isinstance(c, str) and c.strip() for c in categories):
            raise ApiError(400, "base_categories: список строк")
        TaxReserve.objects.update_or_create(business=request.business, defaults={
            "enabled": body["enabled"], "method": method, "period": period, "fixed_amount": fixed,
            "percent": percent, "confirmed_amount": confirmed, "base_categories": [c.strip() for c in categories],
        })
    return json_response(svc.tax_reserve(request.business))


def reminder_fields(body, request, *, creating, instance=None):
    fields = {}
    if "title" in body:
        fields["title"] = text_field(body["title"], "title", 120)
    if "kind" in body:
        fields["kind"] = choice(body["kind"], ("payment", "report"), "kind")
    if "due_date" in body:
        fields["due_date"] = parse_date(body["due_date"])
    if "amount" in body:
        fields["amount"] = None if body["amount"] is None else parse_amount(body["amount"])
    if "status" in body:
        fields["status"] = choice(body["status"], ("planned", "done"), "status")
    if "notify_telegram" in body:
        if not isinstance(body["notify_telegram"], bool):
            raise ApiError(400, "notify_telegram: true или false")
        fields["notify_telegram"] = body["notify_telegram"]
    if creating:
        missing = [k for k in ("title", "kind", "due_date") if k not in fields]
        if missing:
            raise ApiError(400, f"Не хватает полей: {', '.join(missing)}")
    if creating or ("due_date" in fields and fields["due_date"] != instance.due_date):
        if body.get("confirmed") is not True:
            raise ApiError(400, "Дату должен подтвердить пользователь: confirmed: true")
        fields.update(confirmed_by=request.user, confirmed_at=timezone.now(),
                      provenance="accountant_confirmed" if request.role == ACCOUNTANT else "user_setting")
    return fields


@api_view("GET", "POST")
@require_role(*FINANCE_READERS)
def tax_reminders(request):
    if request.method == "POST":
        fields = reminder_fields(parse_json(request), request, creating=True)
        reminder = TaxReminder(business=request.business, **fields)
        svc.sync_tax_obligation(reminder)
        reminder.save()
        return json_response(svc.serialize_reminder(reminder), status=201)
    return json_response({"items": [svc.serialize_reminder(r) for r in TaxReminder.objects.filter(business=request.business)]})


@api_view("PATCH", "DELETE")
@require_role(*FINANCE_READERS)
def tax_reminder_detail(request, id):
    reminder = get_or_404(TaxReminder, request, id, "Напоминание")
    if request.method == "DELETE":
        if reminder.obligation_id:
            reminder.obligation.delete()
        reminder.delete()
        return HttpResponse(status=204)
    for key, value in reminder_fields(parse_json(request), request, creating=False, instance=reminder).items():
        setattr(reminder, key, value)
    svc.sync_tax_obligation(reminder)
    reminder.save()
    return json_response(svc.serialize_reminder(reminder))


# ------------------------------------------------------------------ goals

GOAL_KINDS = tuple(c for c, _ in Goal.Kind.choices)


@api_view("GET", "POST")
def goals(request):
    business = request.business
    if request.role not in FINANCE_READERS or (request.method == "POST" and request.role != OWNER):
        return json_response({"error": "forbidden"}, status=403)
    if request.method == "POST":
        body = parse_json(request)
        missing = [k for k in ("kind", "title", "target") if k not in body]
        if missing:
            raise ApiError(400, f"Не хватает полей: {', '.join(missing)}")
        goal = Goal.objects.create(business=business, **goal_fields(body))
        return json_response(svc.serialize_goal(business, goal), status=201)
    return json_response({"items": [svc.serialize_goal(business, g) for g in Goal.objects.filter(business=business)]})


def goal_fields(body):
    fields = {}
    if "kind" in body:
        fields["kind"] = choice(body["kind"], GOAL_KINDS, "kind")
    if "title" in body:
        fields["title"] = text_field(body["title"], "title", 120)
    if "target" in body:
        fields["target"] = parse_amount(body["target"], "Цель")
    if "due_date" in body:
        fields["due_date"] = None if body["due_date"] is None else parse_date(body["due_date"])
    if "status" in body:
        fields["status"] = choice(body["status"], ("active", "archived"), "status")
    return fields


@api_view("PATCH", "DELETE")
@require_role(OWNER)
def goal_detail(request, id):
    goal = get_or_404(Goal, request, id, "Цель")
    if request.method == "DELETE":
        goal.delete()
        return HttpResponse(status=204)
    for key, value in goal_fields(parse_json(request)).items():
        setattr(goal, key, value)
    goal.save()
    return json_response(svc.serialize_goal(request.business, goal))


@api_view("GET")
@require_role(*FINANCE_READERS)
def benchmarks(request):
    return json_response({"status": "coming_soon", "reason": "Сравнения появятся, когда наберутся когорты от 5 бизнесов"})


# ------------------------------------------------------------------ seasonality, debtors, commitments

@api_view("GET")
@require_role(*FINANCE_READERS)
def seasonality(request):
    return json_response(svc.seasonality(request.business))


@api_view("GET")
@require_role(*FINANCE_READERS)
def debtors(request):
    return json_response({"items": svc.debtors(request.business)})


@api_view("GET", "POST")
@require_role(*FINANCE_READERS)
def debtor_reminders(request):
    business = request.business
    if request.method == "GET":
        return json_response({"items": [svc.serialize_debtor_reminder(r)
                                        for r in DebtorReminder.objects.filter(business=business)]})
    body = parse_json(request)
    name = text_field(body.get("counterparty"), "counterparty", 200)
    debtor = next((d for d in svc.debtors(business) if d["counterparty"] == name), None)
    if debtor is None:
        raise ApiError(404, "Должник не найден")
    reminder = DebtorReminder.objects.create(
        business=business, counterparty=name, amount=debtor["balance"],
        text=svc.reminder_text(name, debtor["balance"], debtor["oldest_due_date"],
                              resolve_lang(request, body)),
    )
    return json_response(svc.serialize_debtor_reminder(reminder), status=201)


@api_view("PATCH")
@require_role(OWNER)
def debtor_reminder_detail(request, id):
    """Только владелец правит текст и одобряет его; черновик никуда не уходит сам."""
    reminder = get_or_404(DebtorReminder, request, id, "Напоминание")
    body = parse_json(request)
    if "text" in body:
        reminder.text = text_field(body["text"], "text", 1000)
        reminder.status, reminder.approved_by = DebtorReminder.Status.DRAFT, None
    if body.get("status") is not None:
        status = choice(body["status"], ("draft", "approved"), "status")
        reminder.status = status
        reminder.approved_by = request.user if status == "approved" else None
    reminder.save()
    return json_response(svc.serialize_debtor_reminder(reminder))


def commitment_fields(body, request, *, creating):
    fields = {}
    if "title" in body:
        fields["title"] = text_field(body["title"], "title", 120)
    if "category" in body:
        fields["category"] = text_field(body["category"], "category", 100)
    if "direction" in body:
        fields["direction"] = choice(body["direction"], ("in", "out"), "direction")
    if "amount" in body:
        fields["amount"] = parse_amount(body["amount"])
    if "frequency" in body:
        fields["frequency"] = choice(body["frequency"], ("weekly", "monthly"), "frequency")
    if "next_date" in body:
        fields["next_date"] = parse_date(body["next_date"])
    if "active" in body:
        if not isinstance(body["active"], bool):
            raise ApiError(400, "active: true или false")
        fields["active"] = body["active"]
    if "account_id" in body:
        account = Account.objects.filter(
            pk=body["account_id"] if isinstance(body["account_id"], int) and not isinstance(body["account_id"], bool) else None,
            business=request.business).first()
        if account is None:
            raise ApiError(400, "Счёт не найден")
        fields["account"] = account
    if creating:
        missing = [k for k in ("title", "category", "amount", "frequency", "next_date", "account") if k not in fields]
        if missing:
            raise ApiError(400, f"Не хватает полей: {', '.join(missing)}")
    return fields


@api_view("GET", "POST")
@require_role(*FINANCE_READERS)
def commitments(request):
    if request.method == "POST":
        c = Commitment.objects.create(
            business=request.business, **commitment_fields(parse_json(request), request, creating=True))
        return json_response(svc.serialize_commitment(c), status=201)
    return json_response({"items": [svc.serialize_commitment(c) for c in Commitment.objects.filter(business=request.business)]})


@api_view("PATCH", "DELETE")
@require_role(*FINANCE_READERS)
def commitment_detail(request, id):
    c = get_or_404(Commitment, request, id, "Платёж")
    if request.method == "DELETE":
        c.delete()
        return HttpResponse(status=204)
    for key, value in commitment_fields(parse_json(request), request, creating=False).items():
        setattr(c, key, value)
    c.save()
    return json_response(svc.serialize_commitment(c))


@api_view("POST")
@require_role(*FINANCE_READERS)
def commitment_confirm(request, id):
    c = get_or_404(Commitment, request, id, "Платёж")
    if not c.active:
        raise ApiError(409, "commitment_inactive")
    tx = svc.confirm_commitment(c, request.user)
    return json_response({"operation": fin.serialize_transaction(tx), "commitment": svc.serialize_commitment(c)},
                         status=201)
