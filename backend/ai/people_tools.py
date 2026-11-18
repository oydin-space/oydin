"""Инструменты чата по людям бизнеса: список (чтение) и черновик добавления (без записи)."""

from accounts.models import Membership
from people import services as svc
from people.models import Person

from accounts.http import ApiError

MAX_LIST = 50


def _allowed(role):
    return role in (Membership.Role.OWNER, Membership.Role.ACCOUNTANT)


def tool_list_people(business, args, user, role, lang=None):
    if not _allowed(role):
        return {"error": "forbidden"}
    people = Person.objects.filter(business=business)
    kind = args.get("kind")
    if kind in Person.Kind.values:
        people = people.filter(kind=kind)
    return {"people": [svc.serialize_person(p) for p in people[:MAX_LIST]], "summary": svc.summary(business)}


def tool_add_person(business, args, user, role, lang=None):
    """Никогда не пишет в БД: проверяет поля и возвращает person_draft. Человека создаёт только клик пользователя
    в вебе (обычный POST /api/people/, где роли и демо проверяет API)."""
    if not _allowed(role) or business.is_demo or user.username == "demo":
        return {"error": "forbidden"}
    body = {k: v for k, v in args.items() if k in svc.FIELDS and k != "location_id"}
    try:
        fields = svc.person_fields(business, body, partial=False)
        svc.check_dates(fields.get("started_on"), fields.get("ended_on"))
    except ApiError as exc:
        return {"error": exc.message}
    draft = {k: (str(v) if v is not None and not isinstance(v, str) else v) for k, v in fields.items()}
    return {"person_draft": draft,
            "instruction": "Человек НЕ добавлен. Это только черновик: скажи, что подготовил карточку и пользователь должен нажать «Подтвердить» в чате."}
