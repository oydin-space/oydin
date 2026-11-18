"""POST /sync/ — пакет офлайн-записей PWA. Каждый client_id применяется один раз."""

from datetime import date

from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.access import SELLER
from accounts.http import ApiError, api_view, json_response, parse_json

from . import services as svc
from .models import Account, Transaction
from .validation import MAX_AMOUNT, transaction_fields

MAX_ITEMS = 100
KINDS = ("operation", "cash_close")


def _result(client_id, status, id=None, error=None):
    return {"client_id": client_id, "status": status, "id": id, "error": error}


def _apply_cash_close(request, client_id, payload):
    from planning.models import CashClose
    from planning.services import expected_balance
    from publicapi.models import SyncRecord

    business = request.business
    account_id, counted, note = payload.get("account_id"), payload.get("counted"), payload.get("note", "")
    account = Account.objects.filter(
        pk=account_id if isinstance(account_id, int) and not isinstance(account_id, bool) else None, business=business
    ).first()
    if account is None:
        return _result(client_id, "error", error="account_not_found")
    if isinstance(counted, bool) or not isinstance(counted, int) or not 0 <= counted <= MAX_AMOUNT:
        return _result(client_id, "error", error="invalid_counted")
    if not isinstance(note, str) or len(note) > 500:
        return _result(client_id, "error", error="invalid_note")
    try:
        day = date.fromisoformat(payload["date"]) if payload.get("date") is not None else timezone.localdate()
    except (TypeError, ValueError):
        return _result(client_id, "error", error="invalid_date")
    if day > timezone.localdate():
        return _result(client_id, "error", error="future_date")
    try:
        with transaction.atomic():
            if CashClose.objects.filter(account=account, date=day).exists():
                return _result(client_id, "error", error="already_closed")
            expected = expected_balance(account, day)
            close = CashClose.objects.create(
                business=business, account=account, date=day, currency=account.currency, expected=expected,
                counted=counted, difference=counted - expected, note=note.strip(), created_by=request.user,
            )
            SyncRecord.objects.create(business=business, client_id=client_id, kind="cash_close", object_id=close.id)
    except IntegrityError:
        existing = SyncRecord.objects.filter(business=business, client_id=client_id).first()
        if existing:
            return _result(client_id, "duplicate", existing.object_id)
        return _result(client_id, "error", error="already_closed")
    return _result(client_id, "created", close.id)


def apply_item(request, item):
    from publicapi.models import SyncRecord
    from publicapi.services import emit

    client_id = item.get("client_id") if isinstance(item, dict) else None
    if not isinstance(client_id, str) or not client_id or len(client_id) > 64:
        return _result(client_id if isinstance(client_id, str) else "", "error", error="invalid_client_id")
    business = request.business
    existing = SyncRecord.objects.filter(business=business, client_id=client_id).first()
    if existing:
        return _result(client_id, "duplicate", existing.object_id)
    kind, payload = item.get("kind"), item.get("payload")
    if kind not in KINDS or not isinstance(payload, dict):
        return _result(client_id, "error", error="invalid_item")
    if kind == "cash_close":
        if request.role == SELLER:
            return _result(client_id, "error", error="forbidden")
        return _apply_cash_close(request, client_id, payload)
    try:
        with transaction.atomic():
            fields = transaction_fields(payload, business, partial=False)
            fields.setdefault("date", timezone.localdate())
            status = payload.get("status", Transaction.Status.CONFIRMED)
            if not isinstance(status, str) or status not in {s for s, _ in Transaction.Status.choices}:
                raise ApiError(400, "invalid_status")
            tx = Transaction.objects.create(
                business=business, status=status, source="offline", created_by=request.user, **fields
            )
            tx = svc.merge_transfer(tx)
            SyncRecord.objects.create(business=business, client_id=client_id, kind=kind, object_id=tx.id)
            emit("transaction.created", tx)
    except ApiError as exc:
        return _result(client_id, "error", error=exc.message)
    except IntegrityError:  # параллельный повтор того же client_id
        existing = SyncRecord.objects.filter(business=business, client_id=client_id).first()
        if existing:
            return _result(client_id, "duplicate", existing.object_id)
        raise
    return _result(client_id, "created", tx.id)


@api_view("POST")
def sync_view(request):
    body = parse_json(request)
    if "business_id" in body and (
        isinstance(body["business_id"], bool) or body["business_id"] != request.business.id
    ):
        raise ApiError(409, "business_mismatch")
    if "user_id" in body and (isinstance(body["user_id"], bool) or body["user_id"] != request.user.id):
        raise ApiError(409, "user_mismatch")
    items = body.get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= MAX_ITEMS:
        raise ApiError(400, f"items: от 1 до {MAX_ITEMS} элементов")
    return json_response({"results": [apply_item(request, item) for item in items]})
