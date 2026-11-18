import uuid

from django.contrib.auth import get_user_model
from django.db import transaction

from finance.models import Account

from .access import active_membership, get_profile
from .models import Business, Membership, Profile


def onboarding_done(user):
    from onboarding.flow import is_done  # onboarding зависит от accounts: импорт внутри

    return is_done(user)


User = get_user_model()
DEMO_USERNAME = "demo"
DEFAULT_ACCOUNTS = (("Наличные", Account.Kind.CASH), ("Карта", Account.Kind.CARD), ("Расчётный счёт", Account.Kind.BANK))


def serialize_business(business):
    return {
        "id": business.id,
        "name": business.name,
        "industry": business.industry,
        "city": business.city,
        "segment": business.segment,
        "tax_regime": business.tax_regime,
    }


def serialize_business_item(membership):
    b = membership.business
    return {"id": b.id, "name": b.name, "industry": b.industry, "city": b.city, "segment": b.segment, "role": membership.role,
            "is_demo": b.is_demo}


def serialize_user(user):
    """Me: пользователь, активный бизнес, роль и все его бизнесы."""
    membership = active_membership(user)
    memberships = Membership.objects.filter(user=user).select_related("business")
    return {
        "id": user.id,
        "name": user.first_name or (user.email.split("@")[0] if user.email else user.username),
        "email": user.email or None,
        "is_staff": user.is_staff,
        "role": membership.role if membership else None,
        "active_business_id": membership.business_id if membership else None,
        "needs_onboarding": membership is None,
        "onboarding_done": onboarding_done(user),
        "business": serialize_business(membership.business) if membership else None,
        "businesses": [
            {"id": m.business_id, "name": m.business.name, "role": m.role, "is_demo": m.business.is_demo,
             "segment": m.business.segment}
            for m in memberships
        ],
    }


@transaction.atomic
def create_business(user, name, industry="", city="", segment=""):
    """Новый бизнес со стандартными счетами; создатель — владелец, бизнес становится активным."""
    business = Business.objects.create(name=name, industry=industry, city=city, segment=segment)
    Membership.objects.create(user=user, business=business, role=Membership.Role.OWNER)
    for title, kind in DEFAULT_ACCOUNTS:
        Account.objects.create(business=business, name=title, kind=kind)
    profile = get_profile(user)
    profile.business = business
    profile.save(update_fields=["business"])
    return business


def claim_invites(user):
    """Приглашения на почту пользователя превращаются в членство (при первом и каждом следующем входе)."""
    if not user.email:
        return
    for invite in Membership.objects.filter(user__isnull=True, invited_email=user.email.lower()):
        if Membership.objects.filter(user=user, business_id=invite.business_id).exists():
            invite.delete()
        else:
            invite.user = user
            invite.save(update_fields=["user"])
    active_membership(user)


def _new_user(email, name=""):
    user = User(username=f"u_{uuid.uuid4().hex[:16]}", email=email, first_name=name[:150])
    user.set_unusable_password()
    user.save()
    Profile.objects.create(user=user)
    return user


@transaction.atomic
def user_for_email(email, name=""):
    """Вход по подтверждённой почте: находим пользователя по email (без учёта регистра) или создаём."""
    user = User.objects.filter(email__iexact=email).order_by("id").first() or _new_user(email, name)
    claim_invites(user)
    return user


@transaction.atomic
def user_for_google(claims):
    email = claims["email"].strip().lower()
    profile = Profile.objects.filter(google_sub=claims["sub"]).select_related("user").first()
    if profile:
        user = profile.user
    else:
        user = User.objects.filter(email__iexact=email).order_by("id").first() or _new_user(email, claims.get("name", ""))
        profile = get_profile(user)
        profile.google_sub = claims["sub"]
        profile.save(update_fields=["google_sub"])
    if not user.email:
        user.email = email
        user.save(update_fields=["email"])
    claim_invites(user)
    return user


@transaction.atomic
def user_for_telegram(tg_user):
    """Пользователь Telegram → наш пользователь; при первом входе создаём пустой бизнес со счетами."""
    profile = Profile.objects.filter(telegram_id=tg_user["id"]).select_related("user").first()
    if profile:
        return profile.user
    name = " ".join(part for part in (tg_user.get("first_name"), tg_user.get("last_name")) if part)
    user = User.objects.create(username=f"tg_{tg_user['id']}", first_name=name or tg_user.get("username", ""))
    user.set_unusable_password()
    user.save()
    Profile.objects.create(user=user, telegram_id=tg_user["id"])
    create_business(user, "Мой бизнес")
    return user


def demo_user():
    user = User.objects.filter(username=DEMO_USERNAME, profile__isnull=False).first()
    if user is None:
        from finance.seed import seed_demo

        return seed_demo()
    # Демо-профиль мог быть переключён на чужой бизнес — каждый вход возвращает к демо-бизнесу.
    membership = Membership.objects.filter(user=user, business__is_demo=True).order_by("business_id").first()
    if membership is not None and user.profile.business_id != membership.business_id:
        user.profile.business_id = membership.business_id
        user.profile.save(update_fields=["business"])
    return user
