"""Ссылки-приглашения: создание/отзыв (только владелец), просмотр по коду и принятие."""

import secrets
from datetime import timedelta

from django.core.cache import cache
from django.db import transaction
from django.http import HttpResponse
from django.utils import timezone

from .access import OWNER, get_profile
from .http import ApiError, api_view, json_response, parse_json
from .models import Invite, Membership
from .services import serialize_user
from .views import _membership_in

INVITE_ROLES = {Membership.Role.ACCOUNTANT, Membership.Role.SELLER}
MIN_HOURS, MAX_HOURS, DEFAULT_HOURS = 1, 24 * 30, 24 * 7
MAX_USES_LIMIT = 100
CREATE_LIMIT_PER_HOUR = 20
PREVIEW_LIMIT_PER_MINUTE = 60


def _throttle(key, limit, ttl):
    cache.add(key, 0, ttl)
    try:
        count = cache.incr(key)
    except ValueError:
        cache.set(key, 1, ttl)
        count = 1
    if count > limit:
        raise ApiError(429, "rate_limited")


def invite_status(invite, now=None):
    now = now or timezone.now()
    if invite.revoked_at:
        return "revoked"
    if invite.expires_at <= now:
        return "expired"
    if invite.uses >= invite.max_uses:
        return "used_up"
    return "active"


def serialize_invite(invite):
    return {
        "id": invite.id,
        "code": invite.code,
        "role": invite.role,
        "expires_at": invite.expires_at.isoformat(),
        "max_uses": invite.max_uses,
        "uses": invite.uses,
        "status": invite_status(invite),
        "created_at": invite.created_at.isoformat(),
    }


def _int(body, key, default, low, high):
    value = body.get(key, default)
    if isinstance(value, bool) or not isinstance(value, int) or not low <= value <= high:
        raise ApiError(400, f"invalid_{key}")
    return value


@api_view("GET", "POST", business=False)
def invites(request, business_id):
    membership = _membership_in(request, business_id, owner=True)
    if request.method == "GET":
        items = Invite.objects.filter(business_id=business_id)[:100]
        return json_response({"items": [serialize_invite(i) for i in items]})
    if membership.business.is_demo:
        raise ApiError(403, "forbidden")
    body = parse_json(request)
    role = body.get("role")
    if role not in INVITE_ROLES:
        raise ApiError(400, "invalid_role")
    hours = _int(body, "expires_in_hours", DEFAULT_HOURS, MIN_HOURS, MAX_HOURS)
    max_uses = _int(body, "max_uses", 1, 1, MAX_USES_LIMIT)
    _throttle(f"invite:create:{request.user.id}", CREATE_LIMIT_PER_HOUR, 3600)
    invite = Invite.objects.create(
        business_id=business_id, code=secrets.token_urlsafe(24), role=role, created_by=request.user,
        expires_at=timezone.now() + timedelta(hours=hours), max_uses=max_uses,
    )
    return json_response(serialize_invite(invite), status=201)


@api_view("DELETE", business=False)
def invite_detail(request, business_id, invite_id):
    _membership_in(request, business_id, owner=True)
    updated = Invite.objects.filter(pk=invite_id, business_id=business_id, revoked_at__isnull=True).update(
        revoked_at=timezone.now()
    )
    if not updated and not Invite.objects.filter(pk=invite_id, business_id=business_id).exists():
        raise ApiError(404, "not_found")
    return HttpResponse(status=204)


def _gone(invite):
    status = invite_status(invite)
    if status != "active":
        raise ApiError(410, f"invite_{status}")


def _client_ip(request):
    return request.META.get("REMOTE_ADDR", "")


@api_view("GET", auth=False)
def invite_preview(request, code):
    _throttle(f"invite:preview:{_client_ip(request)}", PREVIEW_LIMIT_PER_MINUTE, 60)
    invite = Invite.objects.select_related("business").filter(code=code).first()
    if invite is None:
        raise ApiError(404, "not_found")
    _gone(invite)
    return json_response({
        "business_name": invite.business.name,
        "role": invite.role,
        "expires_at": invite.expires_at.isoformat(),
    })


@api_view("POST", business=False)
@transaction.atomic
def invite_accept(request, code):
    invite = Invite.objects.select_for_update().select_related("business").filter(code=code).first()
    if invite is None:
        raise ApiError(404, "not_found")
    existing = Membership.objects.filter(user=request.user, business=invite.business).first()
    if existing is None:
        _gone(invite)
        if invite.business.is_demo:
            raise ApiError(403, "forbidden")
        Membership.objects.create(user=request.user, business=invite.business, role=invite.role)
        invite.uses += 1
        invite.save(update_fields=["uses"])
    # Уже участник: роль не меняем (владельца не понижаем), просто переключаем бизнес.
    profile = get_profile(request.user)
    profile.business = invite.business
    profile.save(update_fields=["business"])
    return json_response(serialize_user(request.user))
