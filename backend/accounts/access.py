"""Единая точка доступа к тенанту: активный бизнес пользователя и его роль в нём.

Активный бизнес — Profile.business, но доступ даёт только Membership. Если активный бизнес
не подтверждён членством, берём первое членство пользователя (и делаем его активным)."""

from functools import wraps

from .models import Membership, Profile

OWNER, ACCOUNTANT, SELLER = Membership.Role.OWNER, Membership.Role.ACCOUNTANT, Membership.Role.SELLER
ALL_ROLES = (OWNER, ACCOUNTANT, SELLER)
# Кто видит деньги бизнеса целиком (остатки, прогноз, обязательства, аналитику).
FINANCE_READERS = (OWNER, ACCOUNTANT)


def get_profile(user):
    profile = getattr(user, "profile", None)
    if profile is None:
        profile, _ = Profile.objects.get_or_create(user=user)
    return profile


def active_membership(user):
    """Членство в активном бизнесе пользователя или None (нужен онбординг)."""
    profile = get_profile(user)
    membership = None
    if profile.business_id:
        membership = Membership.objects.filter(user=user, business_id=profile.business_id).select_related("business").first()
    if membership is None:
        membership = Membership.objects.filter(user=user).select_related("business").first()
        if membership is not None:
            profile.business = membership.business
        elif profile.business_id:
            profile.business = None
        else:
            return None
        profile.save(update_fields=["business"])
    return membership


def resolve(request):
    """Кладёт request.membership / request.business / request.role; возвращает членство или None."""
    membership = active_membership(request.user)
    request.membership = membership
    request.business = membership.business if membership else None
    request.role = membership.role if membership else None
    return membership


def get_business(request):
    if not hasattr(request, "membership"):
        resolve(request)
    return request.business


def require_role(*roles):
    """Пускает только указанные роли в активном бизнесе; иначе 403 {"error": "forbidden"}."""
    from .http import error

    def decorator(view):
        @wraps(view)
        def wrapper(request, *args, **kwargs):
            get_business(request)
            if request.role not in roles:
                return error(403, "forbidden")
            return view(request, *args, **kwargs)

        return wrapper

    return decorator
