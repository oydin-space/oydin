"""Click SHOP API (merchant API) — подпись, коды ошибок и ссылка на оплату.

Документация: https://docs.click.uz/click-api-request/ (prepare/complete),
https://docs.click.uz/click-button/ и https://docs.click.uz/click-api-error/ (коды ошибок),
оплата по ссылке: https://my.click.uz/services/pay?service_id=&merchant_id=&amount=&transaction_param=&return_url=

sign_string = md5(click_trans_id + service_id + SECRET_KEY + merchant_trans_id [+ merchant_prepare_id для complete]
                  + amount + action + sign_time).
"""

import hashlib
import hmac
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode

from django.conf import settings

OK = 0
SIGN_FAILED = -1
BAD_AMOUNT = -2
ACTION_NOT_FOUND = -3
ALREADY_PAID = -4
ORDER_NOT_FOUND = -5
TRANSACTION_NOT_FOUND = -6
UPDATE_FAILED = -7
BAD_REQUEST = -8
CANCELLED = -9

NOTES = {
    OK: "Success",
    SIGN_FAILED: "SIGN CHECK FAILED!",
    BAD_AMOUNT: "Incorrect parameter amount",
    ACTION_NOT_FOUND: "Action not found",
    ALREADY_PAID: "Already paid",
    ORDER_NOT_FOUND: "User does not exist",
    TRANSACTION_NOT_FOUND: "Transaction does not exist",
    UPDATE_FAILED: "Failed to update user",
    BAD_REQUEST: "Error in request from click",
    CANCELLED: "Transaction cancelled",
}

PAY_URL = "https://my.click.uz/services/pay"


def enabled():
    return bool(
        settings.PAYMENTS_ENABLED and settings.CLICK_SERVICE_ID and settings.CLICK_MERCHANT_ID and settings.CLICK_SECRET_KEY
    )


def sign(data, *, complete):
    parts = [data.get("click_trans_id", ""), data.get("service_id", ""), settings.CLICK_SECRET_KEY, data.get("merchant_trans_id", "")]
    if complete:
        parts.append(data.get("merchant_prepare_id", ""))
    parts += [data.get("amount", ""), data.get("action", ""), data.get("sign_time", "")]
    return hashlib.md5("".join(parts).encode()).hexdigest()


def sign_ok(data, *, complete):
    return hmac.compare_digest(sign(data, complete=complete), str(data.get("sign_string", "")).lower())


def amount_matches(raw, expected):
    try:
        return Decimal(raw) == Decimal(expected)
    except (InvalidOperation, TypeError):
        return False


def pay_url(payment, return_url=""):
    params = {
        "service_id": settings.CLICK_SERVICE_ID,
        "merchant_id": settings.CLICK_MERCHANT_ID,
        "amount": payment.amount_uzs,
        "transaction_param": payment.pk,
    }
    if settings.CLICK_MERCHANT_USER_ID:
        params["merchant_user_id"] = settings.CLICK_MERCHANT_USER_ID
    if return_url:
        params["return_url"] = return_url
    return f"{PAY_URL}?{urlencode(params)}"
