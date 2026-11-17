from datetime import date

from accounts.http import ApiError

from .models import Account, Transaction

DIRECTIONS = {c for c, _ in Transaction.Direction.choices}
PURPOSES = {c for c, _ in Transaction.Purpose.choices}
MAX_AMOUNT = 10**13


def parse_date(value):
    try:
        return date.fromisoformat(value)
    except (TypeError, ValueError):
        raise ApiError(400, "Дата должна быть в формате ГГГГ-ММ-ДД") from None


def parse_amount(value, label="Сумма"):
    if isinstance(value, bool) or not isinstance(value, int) or not 1 <= value <= MAX_AMOUNT:
        raise ApiError(400, f"{label} должна быть целым числом сумов больше нуля")
    return value


def transaction_fields(body, business, *, partial):
    """Проверенные поля TransactionInput для создания/изменения операции."""
    required = ("amount", "direction", "category", "account_id")
    if not partial:
        missing = [k for k in required if k not in body]
        if missing:
            raise ApiError(400, f"Не хватает полей: {', '.join(missing)}")
    fields = {}
    if "amount" in body:
        fields["amount"] = parse_amount(body["amount"])
    if "direction" in body:
        if body["direction"] not in DIRECTIONS:
            raise ApiError(400, "direction: in, out или transfer")
        fields["direction"] = body["direction"]
    if "category" in body:
        category = body["category"]
        if not isinstance(category, str) or not category.strip() or len(category) > 100:
            raise ApiError(400, "Категория не должна быть пустой")
        fields["category"] = category.strip()
    if "purpose" in body:
        if body["purpose"] not in PURPOSES:
            raise ApiError(400, "purpose: business, personal или unclear")
        fields["purpose"] = body["purpose"]
    if "account_id" in body:
        account = Account.objects.filter(pk=body["account_id"] if isinstance(body["account_id"], int) else None,
                                         business=business).first()
        if account is None:
            raise ApiError(400, "Счёт не найден")
        fields["account"] = account
    if "date" in body:
        fields["date"] = parse_date(body["date"])
    if "counterparty" in body:
        value = body["counterparty"]
        if value is not None and (not isinstance(value, str) or len(value) > 200):
            raise ApiError(400, "Некорректный контрагент")
        fields["counterparty"] = value or None
    if "note" in body:
        if not isinstance(body["note"], str):
            raise ApiError(400, "Заметка должна быть строкой")
        fields["note"] = body["note"]
    return fields
