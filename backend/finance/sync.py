"""POST /sync/ — пакет офлайн-записей PWA. Каждый client_id применяется один раз."""

from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.access import SELLER
from accounts.http import ApiError, api_view, json_response, parse_json

from . import services as svc
from .models import Transaction
from .validation import transaction_fields

MAX_ITEMS = 100
KINDS = ("operation", "cash_close")


def _result(client_id, status, id=None, error=None):
    return {"client_id": client_id, "status": status, "id": id, "error": error}


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
        return _result(client_id, "error", error="cash_close_unavailable")
    try:
        with transaction.atomic():
            fields = transaction_fields(payload, business, partial=False)
            fields.setdefault("date", timezone.localdate())
            status = payload.get("status", Transaction.Status.CONFIRMED)
            if status not in {s for s, _ in Transaction.Status.choices}:
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
    items = parse_json(request).get("items")
    if not isinstance(items, list) or not 1 <= len(items) <= MAX_ITEMS:
        raise ApiError(400, f"items: от 1 до {MAX_ITEMS} элементов")
    return json_response({"results": [apply_item(request, item) for item in items]})
