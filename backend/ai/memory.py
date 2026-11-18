"""Память ИИ: факты о бизнесе и пользователе + профили. Все выборки ограничены бизнесом и ролью запросившего."""

from accounts.models import Membership

from .models import BusinessProfile, MemoryFact

MAX_TEXT = 300
MAX_FACTS = 50  # на одну область (бизнес / пользователь)


def _is_seller(role):
    return role == Membership.Role.SELLER


def visible(business, user, role):
    """Факты, доступные участнику: продавцу — только личные, остальным — бизнес + личные."""
    own = MemoryFact.objects.filter(business=business, user=user, scope=MemoryFact.Scope.USER)
    if _is_seller(role):
        return own
    shared = MemoryFact.objects.filter(business=business, user=None, scope=MemoryFact.Scope.BUSINESS)
    return (own | shared).order_by("id")


def serialize(fact):
    return {"id": fact.id, "scope": fact.scope, "text": fact.text, "source": fact.source,
            "created_at": fact.created_at.isoformat(), "updated_at": fact.updated_at.isoformat()}


def remember(business, user, role, scope, text, source="chat"):
    if scope not in MemoryFact.Scope.values:
        return {"error": "scope: business или user"}
    if not isinstance(text, str) or not text.strip():
        return {"error": "text обязателен"}
    if scope == MemoryFact.Scope.BUSINESS and _is_seller(role):
        return {"error": "forbidden"}
    text = " ".join(text.split())[:MAX_TEXT]
    owner = {"business": business, "user": user if scope == MemoryFact.Scope.USER else None}
    existing = MemoryFact.objects.filter(scope=scope, **owner)
    if existing.filter(text__iexact=text).exists():
        return {"ok": True, "duplicate": True}
    if existing.count() >= MAX_FACTS:
        return {"error": f"память заполнена ({MAX_FACTS}), сначала забудьте лишнее"}
    return {"ok": True, "fact": serialize(MemoryFact.objects.create(scope=scope, text=text, source=source, **owner))}


def forget(business, user, role, fact_id):
    try:
        fact = visible(business, user, role).get(id=int(fact_id))
    except (TypeError, ValueError, MemoryFact.DoesNotExist):
        return {"error": "факт не найден"}
    fact.delete()
    return {"ok": True}


def _profile(business):
    p = BusinessProfile.objects.filter(business=business).first()
    return {
        "name": business.name,
        "inn": p.inn if p else "",
        "activity": (p.activity if p and p.activity else business.industry),
        "plans": p.plans if p else "",
        "problems": p.problems if p else "",
    }


def get_context(business, user, role, lang=None):
    """Профиль пользователя и бизнеса + факты памяти (для продавца — без бизнес-профиля и общих фактов)."""
    ctx = {
        "user": {"name": user.first_name or user.username, "email": user.email, "role": role, "lang": lang,
                 "telegram_linked": bool(getattr(getattr(user, "profile", None), "telegram_id", None))},
        "memory": [{"id": f.id, "scope": f.scope, "text": f.text} for f in visible(business, user, role)],
    }
    if not _is_seller(role):
        ctx["business"] = _profile(business)
    return ctx


def compact(ctx):
    """Короткий текст для системного промпта."""
    u = ctx["user"]
    lines = [f"Пользователь: {u['name']}, роль {u['role']}, язык {u['lang'] or '—'}" + (f", email {u['email']}" if u["email"] else "")]
    b = ctx.get("business")
    if b:
        parts = [f"{k}: {v}" for k, v in (("название", b["name"]), ("ИНН", b["inn"]), ("деятельность", b["activity"]), ("планы", b["plans"]), ("проблемы", b["problems"])) if v]
        lines.append("Бизнес: " + "; ".join(parts))
    for f in ctx["memory"]:
        lines.append(f"[{f['id']}] ({f['scope']}) {f['text']}")
    return "\n".join(lines)


# --- инструменты агента ---

def tool_remember(business, args, user, role, lang=None):
    return remember(business, user, role, args.get("scope"), args.get("text"))


def tool_forget(business, args, user, role, lang=None):
    return forget(business, user, role, args.get("id"))


def tool_get_context(business, args, user, role, lang=None):
    return get_context(business, user, role, lang)
