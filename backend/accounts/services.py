from django.contrib.auth import get_user_model
from django.db import transaction

from finance.models import Account

from .models import Business, Profile

User = get_user_model()
DEMO_USERNAME = "demo"


def serialize_business(business):
    return {
        "id": business.id,
        "name": business.name,
        "industry": business.industry,
        "city": business.city,
        "tax_regime": business.tax_regime,
    }


def serialize_user(user):
    return {
        "id": user.id,
        "name": user.first_name or user.username,
        "business": serialize_business(user.profile.business),
    }


@transaction.atomic
def user_for_telegram(tg_user):
    """Пользователь Telegram → наш пользователь; при первом входе создаём пустой бизнес со счетами."""
    profile = Profile.objects.filter(telegram_id=tg_user["id"]).select_related("user", "business").first()
    if profile:
        return profile.user
    name = " ".join(part for part in (tg_user.get("first_name"), tg_user.get("last_name")) if part)
    user = User.objects.create(username=f"tg_{tg_user['id']}", first_name=name or tg_user.get("username", ""))
    user.set_unusable_password()
    user.save()
    business = Business.objects.create(name="Мой бизнес")
    Profile.objects.create(user=user, business=business, telegram_id=tg_user["id"])
    for title, kind in (("Наличные", Account.Kind.CASH), ("Карта", Account.Kind.CARD), ("Расчётный счёт", Account.Kind.BANK)):
        Account.objects.create(business=business, name=title, kind=kind)
    return user


def demo_user():
    user = User.objects.filter(username=DEMO_USERNAME, profile__isnull=False).first()
    if user is None:
        from finance.seed import seed_demo

        user = seed_demo()
    return user
