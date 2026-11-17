"""Ссылки доступа, согласия партнёров, анонимные лиды и публичные счётчики."""

import hashlib
import hmac
import secrets
import string
from datetime import timedelta

from django.apps import apps
from django.conf import settings
from django.core.cache import cache
from django.db.models import Sum
from django.utils import timezone

from accounts.models import Business
from finance import services as fin
from finance.domain import forecast as fc
from finance.models import Transaction
from finance.rates import rows_to_uzs

from .models import Partner, PartnerConsent, PartnerLeadState, ShareLink

ALPHABET = string.ascii_letters + string.digits
TOKEN_LENGTH = 43  # 43 символа base62 ≈ 256 бит
DEFAULT_DAYS = 30
CONSENT_TEXT_VERSION = "2026-11-v1"
CONSENT_SCOPE = (
    "Банк/МФО увидит анонимный лид: сегмент, город, срок работы, диапазон выручки за 90 дней и диапазон "
    "ближайшего кассового разрыва. Без названия, контактов и операций. Согласие можно отозвать в любой момент."
)
DISCLAIMER = "Отчёт сформирован из данных, внесённых владельцем бизнеса. Не является налоговой или аудиторской отчётностью."
K_THRESHOLD = 5
IMPACT_TTL = 3600


def share_days_max():
    return getattr(settings, "SHARE_LINK_MAX_DAYS", 180)


def public_base():
    return getattr(settings, "PUBLIC_BASE_URL", "https://oydin.sayfi.uz").rstrip("/")


# ───────────── share links ─────────────


def hash_token(token):
    return hashlib.sha256(token.encode()).hexdigest()


def new_token():
    return "".join(secrets.choice(ALPHABET) for _ in range(TOKEN_LENGTH))


def previous_month(today):
    last = today.replace(day=1) - timedelta(days=1)
    return last.replace(day=1), last


def create_link(business, user, label="", period_from=None, period_to=None, expires_at=None):
    now = timezone.now()
    if period_from is None and period_to is None:
        period_from, period_to = previous_month(timezone.localdate())
    token = new_token()
    link = ShareLink.objects.create(
        business=business, created_by=user, label=label, token_hash=hash_token(token),
        period_from=period_from, period_to=period_to,
        expires_at=expires_at or now + timedelta(days=DEFAULT_DAYS),
    )
    return link, token


def serialize_link(link, token=None):
    return {
        "id": link.id, "label": link.label,
        # Токен хранится только в виде хэша: полная ссылка видна один раз — при создании.
        "url": f"{public_base()}/shared/{token}" if token else "",
        "period_from": link.period_from.isoformat(), "period_to": link.period_to.isoformat(),
        "expires_at": link.expires_at.isoformat(),
        "revoked_at": link.revoked_at.isoformat() if link.revoked_at else None,
        "created_at": link.created_at.isoformat(), "views": link.views,
        "last_viewed_at": link.last_viewed_at.isoformat() if link.last_viewed_at else None,
    }


def find_link(token):
    """Ссылка по токену или None; сравнение хэшей в постоянном времени."""
    if not token or len(token) > 128:
        return None
    digest = hash_token(token)
    link = ShareLink.objects.select_related("business").filter(token_hash=digest).first()
    if link is None or not hmac.compare_digest(link.token_hash, digest):
        return None
    return link


def link_state(link, now=None):
    now = now or timezone.now()
    if link.revoked_at:
        return "revoked"
    if link.expires_at <= now:
        return "expired"
    return "ok"


def record_view(link):
    ShareLink.objects.filter(pk=link.pk).update(views=link.views + 1, last_viewed_at=timezone.now())


def shared_report(link):
    business, start, end = link.business, link.period_from, link.period_to
    totals = fin.period_totals(business, start, end)
    qs = fin.confirmed(business).filter(date__gte=start, date__lte=end)
    missing = []
    if qs.filter(purpose=Transaction.Purpose.UNCLEAR).exists():
        missing.append("unclear_purpose")
    cats = {}
    rows = (qs.exclude(direction="transfer").order_by()
            .values("category", "purpose", "direction", "account__currency").annotate(s=Sum("amount")))
    for row in rows:
        # Личные траты — одной строкой, без детализации по категориям.
        name = "personal" if row["purpose"] == Transaction.Purpose.PERSONAL else row["category"]
        entry = cats.setdefault(name, {"category": name, "inflow": 0, "outflow": 0})
        key = "inflow" if row["direction"] == "in" else "outflow"
        entry[key] += rows_to_uzs([row])
    b = fin.bundle(business, 30)
    return {
        "business_name": business.name,
        "generated_at": timezone.now().isoformat(),
        "period": {
            "period_from": start.isoformat(), "period_to": end.isoformat(), "currency": "UZS",
            "revenue": totals["revenue"], "expenses": totals["expenses"],
            "profit": None if missing else totals["profit"], "cash_change": totals["cash_flow"],
            "owner_draws": totals["owner_draws"], "owner_contributions": totals["owner_contributions"],
            "missing_data": missing,
        },
        "accounts": fin.list_accounts(business),
        "by_category": sorted(cats.values(), key=lambda c: -(c["inflow"] + c["outflow"])),
        "obligations": [fin.serialize_obligation(o) for o in fin.obligation_dicts(business, b)],
        "cash_closes": _cash_closes(business, start, end),
        "tax_reserve": None,
        "disclaimer": DISCLAIMER,
    }


def _cash_closes(business, start, end):
    """Сверки кассы живут в планировании; пока модели нет — пустой список."""
    try:
        model = apps.get_model("finance", "CashClose")
    except LookupError:
        return []
    qs = model.objects.filter(business=business, date__gte=start, date__lte=end)
    return [{
        "id": c.id, "date": c.date.isoformat(), "account_id": c.account_id, "currency": c.account.currency,
        "expected": c.expected, "counted": c.counted, "difference": c.counted - c.expected,
        "note": c.note, "created_by": None, "created_at": c.created_at.isoformat(),
    } for c in qs.select_related("account")]


# ───────────── partner consents ─────────────


def serialize_partner(p):
    return {"id": p.id, "name": p.name, "kind": p.kind, "logo_url": p.logo_url}


def serialize_consent(partner, consent):
    return {
        "partner": serialize_partner(partner),
        "granted": bool(consent and consent.revoked_at is None),
        "granted_at": consent.granted_at.isoformat() if consent else None,
        "revoked_at": consent.revoked_at.isoformat() if consent and consent.revoked_at else None,
        "scope": CONSENT_SCOPE,
    }


def latest_consents(business):
    """partner_id → последняя запись согласия."""
    latest = {}
    for c in PartnerConsent.objects.filter(business=business):  # от новых к старым
        latest.setdefault(c.partner_id, c)
    return latest


def grant(business, partner, user):
    existing = PartnerConsent.objects.filter(business=business, partner=partner, revoked_at__isnull=True).first()
    if existing:
        return existing
    return PartnerConsent.objects.create(
        business=business, partner=partner, granted_at=timezone.now(),
        text_version=CONSENT_TEXT_VERSION, granted_by=user,
    )


def revoke(business, partner):
    PartnerConsent.objects.filter(business=business, partner=partner, revoked_at__isnull=True).update(
        revoked_at=timezone.now()
    )
    return PartnerConsent.objects.filter(business=business, partner=partner).first()


# ───────────── anonymised leads ─────────────


def alias(partner_id, business_id):
    key = settings.SECRET_KEY.encode()
    return hmac.new(key, f"lead:{partner_id}:{business_id}".encode(), hashlib.sha256).hexdigest()[:16]


def revenue_band(amount):
    if amount < 50_000_000:
        return "<50m"
    if amount < 200_000_000:
        return "50m-200m"
    if amount < 1_000_000_000:
        return "200m-1b"
    return ">1b"


def gap_band(amount):
    if amount < 10_000_000:
        return "<10m"
    if amount < 50_000_000:
        return "10m-50m"
    if amount < 200_000_000:
        return "50m-200m"
    return ">200m"


def months_active(business, today):
    first = Transaction.objects.filter(business=business).order_by("date").values_list("date", flat=True).first()
    if first is None:
        return 0
    return max(0, (today.year - first.year) * 12 + today.month - first.month)


def current_gap(business, today=None):
    b = fin.bundle(business, 90, today)
    return fc.find_gap(b.points, b.flows, b.today), b.today


def build_lead(partner, consent, state=None):
    business = consent.business
    gap, today = current_gap(business)
    revenue = fin.period_totals(business, today - timedelta(days=89), today)["revenue"]
    return {
        "id": alias(partner.id, business.id),
        "segment": getattr(business, "segment", None) or "services",
        "city": business.city,
        "months_active": months_active(business, today),
        "revenue_band": revenue_band(revenue),
        "gap_amount_band": gap_band(gap.amount) if gap else None,
        "gap_date": gap.date.isoformat() if gap else None,
        "consented_at": consent.granted_at.isoformat(),
        "status": state.status if state else PartnerLeadState.Status.NEW,
    }


def partner_leads(partner):
    consents = list(PartnerConsent.objects.filter(partner=partner, revoked_at__isnull=True).select_related("business"))
    states = {s.business_id: s for s in PartnerLeadState.objects.filter(partner=partner)}
    return [(c, build_lead(partner, c, states.get(c.business_id))) for c in consents]


def find_lead(partner, lead_id):
    for consent in PartnerConsent.objects.filter(partner=partner, revoked_at__isnull=True).select_related("business"):
        if hmac.compare_digest(alias(partner.id, consent.business_id), lead_id):
            return consent
    return None


def set_lead_status(partner, consent, status):
    state, _ = PartnerLeadState.objects.update_or_create(
        partner=partner, business=consent.business, defaults={"status": status}
    )
    return build_lead(partner, consent, state)


# ───────────── impact ─────────────


def _suppress(n):
    return n if n >= K_THRESHOLD else 0


def compute_impact():
    real = Business.objects.filter(is_demo=False, transactions__status="confirmed").distinct()
    businesses = real.count()
    now = timezone.localdate()
    ops = Transaction.objects.filter(business__is_demo=False, status="confirmed").count()
    closes = 0
    try:
        closes = apps.get_model("finance", "CashClose").objects.filter(business__is_demo=False).count()
    except LookupError:
        pass
    gaps = 0
    if businesses >= K_THRESHOLD:
        for business in real:
            gap, today = current_gap(business, now)
            if gap and (gap.date - today).days >= 3:
                gaps += 1
    suppressed = businesses < K_THRESHOLD
    return {
        # k-анонимность: при малой выборке счётчики скрыты (0), а не раскрывают единичные бизнесы.
        "businesses": 0 if suppressed else businesses,
        "operations_recorded": 0 if suppressed else ops,
        "cash_closes": 0 if suppressed else _suppress(closes),
        "gaps_flagged": 0 if suppressed else _suppress(gaps),
        "suppressed": suppressed,
        "updated_at": timezone.now().isoformat(),
    }


def impact():
    data = cache.get("sharing:impact")
    if data is None:
        data = compute_impact()
        cache.set("sharing:impact", data, IMPACT_TTL)
    return data
