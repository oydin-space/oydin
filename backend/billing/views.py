from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.http import JsonResponse
from django.utils import timezone
from django.views.decorators.csrf import csrf_exempt

from accounts.access import OWNER, require_role
from accounts.http import ApiError, api_view, json_response, parse_json
from planning.texts import resolve_lang

from . import click
from .models import Payment, Plan, Subscription

PERIOD = timedelta(days=30)


def pick(value, lang):
    return value.get(lang) or value.get("ru") or value.get("en") or "" if isinstance(value, dict) else ""


def pick_list(value, lang):
    if not isinstance(value, dict):
        return []
    return list(value.get(lang) or value.get("ru") or value.get("en") or [])


def serialize(p, lang):
    return {
        "code": p.code, "name": pick(p.name, lang), "tagline": pick(p.tagline, lang), "cta_note": pick(p.cta_note, lang),
        "icon": p.icon, "price_uzs": p.price_uzs, "period": p.period, "popular": p.is_popular, "image": p.image,
        "features": pick_list(p.features, lang), "new_features": pick_list(p.new_features, lang),
        "missing": pick_list(p.missing, lang), "limits": pick_list(p.limits, lang),
    }


@api_view("GET", auth=False)
def plans(request):
    lang = resolve_lang(request)
    response = json_response({"plans": [serialize(p, lang) for p in Plan.objects.filter(is_active=True)]})
    response["Cache-Control"] = "public, max-age=300"
    return response


@api_view("GET")
def subscription(request):
    sub = Subscription.objects.filter(business=request.business).select_related("plan").first()
    if sub is None:
        return json_response({"plan": "free", "status": "free", "renews_at": None})
    if sub.status == Subscription.Status.ACTIVE and sub.renews_at and sub.renews_at < timezone.now():
        return json_response({"plan": "free", "status": "free", "renews_at": None})
    return json_response({"plan": sub.plan.code, "status": sub.status, "renews_at": sub.renews_at.isoformat() if sub.renews_at else None})


@api_view("POST")
@require_role(OWNER)
def checkout(request):
    body = parse_json(request)
    plan = Plan.objects.filter(code=str(body.get("plan", "")), is_active=True).first()
    if plan is None:
        raise ApiError(400, "unknown_plan")
    if plan.price_uzs == 0:
        raise ApiError(400, "free_plan")
    if not click.enabled():
        return json_response({"available": False})
    payment = Payment.objects.create(business=request.business, user=request.user, plan=plan, amount_uzs=plan.price_uzs)
    sub, _ = Subscription.objects.get_or_create(business=request.business, defaults={"plan": plan})
    if sub.status != Subscription.Status.ACTIVE:
        sub.plan, sub.status = plan, Subscription.Status.PENDING
        sub.save()
    return_url = request.build_absolute_uri("/app/billing") + f"?plan={plan.code}"
    return json_response({"available": True, "url": click.pay_url(payment, return_url)})


def reply(data, code, **extra):
    body = {
        "click_trans_id": data.get("click_trans_id"), "merchant_trans_id": data.get("merchant_trans_id"),
        "error": code, "error_note": click.NOTES[code], **extra,
    }
    return JsonResponse(body)


def check_common(data, complete):
    """Общие проверки; возвращает (payment|None, код ошибки)."""
    if not click.enabled():
        return None, click.BAD_REQUEST
    if str(data.get("service_id", "")) != str(settings.CLICK_SERVICE_ID) or not click.sign_ok(data, complete=complete):
        return None, click.SIGN_FAILED
    if data.get("action") != ("1" if complete else "0"):
        return None, click.ACTION_NOT_FOUND
    merchant = str(data.get("merchant_trans_id", ""))
    payment = Payment.objects.select_for_update().filter(pk=int(merchant)).first() if merchant.isdigit() else None
    if payment is None:
        return None, click.ORDER_NOT_FOUND
    if not click.amount_matches(data.get("amount"), payment.amount_uzs):
        return payment, click.BAD_AMOUNT
    return payment, click.OK


@csrf_exempt
def prepare(request):
    if request.method != "POST":
        return JsonResponse({"error": click.BAD_REQUEST, "error_note": click.NOTES[click.BAD_REQUEST]}, status=405)
    data = request.POST
    with transaction.atomic():
        payment, code = check_common(data, False)
        if code:
            return reply(data, code)
        if payment.status == Payment.Status.PAID:
            return reply(data, click.ALREADY_PAID)
        if payment.status == Payment.Status.CANCELLED:
            return reply(data, click.CANCELLED)
        payment.status = Payment.Status.PREPARED
        payment.click_trans_id = str(data.get("click_trans_id", ""))
        payment.click_paydoc_id = str(data.get("click_paydoc_id", ""))
        payment.save()
        return reply(data, click.OK, merchant_prepare_id=payment.pk)


@csrf_exempt
def complete(request):
    if request.method != "POST":
        return JsonResponse({"error": click.BAD_REQUEST, "error_note": click.NOTES[click.BAD_REQUEST]}, status=405)
    data = request.POST
    with transaction.atomic():
        payment, code = check_common(data, True)
        if code and code != click.BAD_AMOUNT or payment is None:
            return reply(data, code or click.ORDER_NOT_FOUND)
        if str(data.get("merchant_prepare_id", "")) != str(payment.pk) or payment.status == Payment.Status.PENDING:
            return reply(data, click.TRANSACTION_NOT_FOUND)
        if payment.status == Payment.Status.PAID:
            return reply(data, click.ALREADY_PAID)
        if payment.status == Payment.Status.CANCELLED:
            return reply(data, click.CANCELLED)
        if code:
            return reply(data, code)
        if str(data.get("error", "0")) != "0":
            payment.status = Payment.Status.CANCELLED
            payment.save()
            return reply(data, click.CANCELLED)
        now = timezone.now()
        payment.status, payment.paid_at = Payment.Status.PAID, now
        payment.save()
        sub, _ = Subscription.objects.select_for_update().get_or_create(business=payment.business, defaults={"plan": payment.plan})
        base = sub.renews_at if sub.status == Subscription.Status.ACTIVE and sub.plan_id == payment.plan_id and sub.renews_at and sub.renews_at > now else now
        sub.plan, sub.status, sub.renews_at = payment.plan, Subscription.Status.ACTIVE, base + PERIOD
        sub.save()
        return reply(data, click.OK, merchant_confirm_id=payment.pk)
