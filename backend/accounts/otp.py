"""Вход по одноразовому коду на почту: 6 цифр, в БД только HMAC, 10 минут, 5 попыток, лимиты на отправку."""

import hashlib
import hmac
import secrets
from datetime import timedelta

from django.conf import settings
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.core.mail import send_mail
from django.core.validators import validate_email
from django.utils import timezone

from .http import ApiError
from .models import EmailCode

TTL = timedelta(minutes=10)
RESEND_SECONDS = 60
MAX_ATTEMPTS = 5
PER_EMAIL_HOURLY = 5
PER_IP_HOURLY = 20

TEXTS = {
    "ru": ("Код входа в Oydin: {code}", "Ваш код входа в Oydin: {code}\n\nКод действует 10 минут. "
           "Если вы не запрашивали вход, просто проигнорируйте письмо."),
    "uz": ("Oydin kirish kodi: {code}", "Oydin'ga kirish kodingiz: {code}\n\nKod 10 daqiqa amal qiladi. "
           "Agar siz kirishni so'ramagan bo'lsangiz, xatni e'tiborsiz qoldiring."),
    "en": ("Your Oydin sign-in code: {code}", "Your Oydin sign-in code is {code}\n\nThe code is valid for 10 minutes. "
           "If you did not request it, just ignore this email."),
}


def normalize_email(raw):
    email = raw.strip().lower() if isinstance(raw, str) else ""
    try:
        validate_email(email)
    except ValidationError:
        raise ApiError(400, "invalid_email") from None
    return email


def _hash(email, code):
    return hmac.new(settings.SECRET_KEY.encode(), f"{email}:{code}".encode(), hashlib.sha256).hexdigest()


def _ip_allowed(ip):
    key = f"otp-ip:{ip}"
    cache.add(key, 0, 3600)
    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, 3600)
        count = 1
    return count <= PER_IP_HOURLY


def request_code(email, ip, lang):
    """Отправляет код. Ответ одинаковый для любых адресов: пользователь создаётся только после verify."""
    if not settings.EMAIL_CONFIGURED:
        raise ApiError(503, "email_not_configured")
    now = timezone.now()
    recent = EmailCode.objects.filter(email=email, created_at__gt=now - timedelta(hours=1))
    if recent.filter(created_at__gt=now - timedelta(seconds=RESEND_SECONDS)).exists() or recent.count() >= PER_EMAIL_HOURLY:
        raise ApiError(429, "rate_limited")
    if not _ip_allowed(ip):
        raise ApiError(429, "rate_limited")
    code = f"{secrets.randbelow(10**6):06d}"
    # Новый код отменяет прежние.
    EmailCode.objects.filter(email=email, used=False).update(used=True)
    EmailCode.objects.create(email=email, code_hash=_hash(email, code), expires_at=now + TTL)
    subject, body = TEXTS.get(lang, TEXTS["ru"])
    send_mail(subject.format(code=code), body.format(code=code), settings.DEFAULT_FROM_EMAIL, [email])


def verify_code(email, code):
    """True — код верный (и погашен). Неверный/просроченный — ApiError 400, исчерпаны попытки — 429."""
    row = EmailCode.objects.filter(email=email, used=False, expires_at__gt=timezone.now()).first()
    if row is None:
        raise ApiError(400, "invalid_code")
    if row.attempts >= MAX_ATTEMPTS:
        raise ApiError(429, "rate_limited")
    if not isinstance(code, str) or not hmac.compare_digest(row.code_hash, _hash(email, code.strip())):
        EmailCode.objects.filter(pk=row.pk).update(attempts=row.attempts + 1)
        raise ApiError(400, "invalid_code")
    EmailCode.objects.filter(pk=row.pk).update(used=True)
    return True
