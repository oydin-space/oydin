"""Раздельные согласия пользователя (ИИ, маркетинг, лиды партнёрам) и принятие условий."""

from django.db import transaction
from django.utils import timezone

from .access import get_profile
from .http import ApiError, api_view, json_response, parse_json
from .models import Consent, ConsentEvent

PURPOSES = tuple(p.value for p in Consent.Purpose)
LEGAL_VERSION = "2026-11-18"


def has_consent(user, purpose):
    return Consent.objects.filter(user=user, purpose=purpose, granted=True).exists()


def set_consent(user, purpose, granted, version=LEGAL_VERSION):
    """Меняет согласие; каждое изменение значения попадает в журнал."""
    with transaction.atomic():
        consent, created = Consent.objects.select_for_update().get_or_create(
            user=user, purpose=purpose, defaults={"granted": granted, "text_version": version}
        )
        if not created:
            if consent.granted == granted:
                return consent
            consent.granted, consent.text_version = granted, version
            consent.save()
        ConsentEvent.objects.create(user=user, purpose=purpose, granted=granted, text_version=version)
    return consent


def snapshot(user):
    profile = get_profile(user)
    rows = {c.purpose: c for c in Consent.objects.filter(user=user)}
    stamps = [c.updated_at for c in rows.values()] + ([profile.terms_accepted_at] if profile.terms_accepted_at else [])
    return {
        "terms_version": profile.terms_version or None,
        **{p: bool(rows[p].granted) if p in rows else False for p in PURPOSES},
        "updated_at": max(stamps).isoformat() if stamps else None,
    }


@api_view("GET", "PUT", business=False)
def consents(request):
    if request.method == "PUT":
        body = parse_json(request)
        for purpose in PURPOSES:
            if purpose in body and not isinstance(body[purpose], bool):
                raise ApiError(400, f"{purpose}: нужно true или false")
        version = body.get("terms_version")
        if version is not None and (not isinstance(version, str) or not 0 < len(version) <= 20):
            raise ApiError(400, "terms_version: строка до 20 символов")
        with transaction.atomic():
            for purpose in PURPOSES:
                if purpose in body:
                    set_consent(request.user, purpose, body[purpose])
            if version is not None:
                profile = get_profile(request.user)
                profile.terms_version, profile.terms_accepted_at = version, timezone.now()
                profile.save(update_fields=["terms_version", "terms_accepted_at"])
    return json_response(snapshot(request.user))
