"""Серверная машина состояний онбординга: шаги, валидация ответов, сохранение и синхронизация памяти ИИ.

Каждый ответ идемпотентен: повторная отправка шага перезаписывает данные, факты памяти заменяются,
а не дублируются. Без бизнеса память копится в answers и записывается, как только бизнес появляется.
"""

import math
import re
from datetime import time

from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.utils import timezone

from accounts.access import OWNER, active_membership
from accounts.consent import has_consent, set_consent
from accounts.http import ApiError
from accounts.models import Business
from accounts.services import create_business
from ai import memory
from ai.models import BusinessProfile

from .models import OnboardingSession, RegistryLookup, UserProfile

STEPS = ("consent", "name", "contact", "business", "activity", "pains", "goals", "upload", "invite", "install", "tour", "summary")
REQUIRED = {"consent", "name", "business", "summary"}
OWNER_ONLY = {"business", "activity", "pains", "goals", "upload", "invite"}
LANGS = {"ru", "uz", "en"}
SEGMENTS = {c.value for c in Business.Segment}
LEGAL_FORMS = {"yatt", "llc", "self_employed", "family", "other"}
STAGES = {"running", "idea"}
CHANNELS = {"instagram", "telegram", "marketplace", "shop", "market", "b2b", "other"}
TEAM = {"solo": "только я", "2_5": "2–5 человек", "6_20": "6–20 человек", "20plus": "больше 20 человек"}
PAINS = {
    "cash_gaps": "кассовые разрывы",
    "debts": "долги клиентов",
    "taxes": "налоги и отчётность",
    "chaos": "хаос в записях",
    "stock": "склад и остатки",
    "pricing": "цены и наценка",
    "team": "контроль команды",
    "growth": "нет роста продаж",
}
GOALS = {
    "see_profit": "видеть реальную прибыль",
    "collect_debts": "собрать долги",
    "taxes_on_time": "платить налоги вовремя",
    "save": "накопить запас",
    "grow": "вырасти в продажах",
    "credit": "подготовиться к кредиту",
    "start": "запустить бизнес",
}
UPLOAD_SOURCES = {"import", "zero"}


def bad(code):
    raise ApiError(400, code)


def user_profile(user):
    return UserProfile.objects.get_or_create(user=user)[0]


def is_demo(user):
    membership = active_membership(user)
    return bool(membership and membership.business.is_demo)


def applicable(user):
    """Шаги, которые этот пользователь проходит: участникам (не владельцам) — без бизнес-блока."""
    membership = active_membership(user)
    if membership is not None and membership.role != OWNER:
        return [s for s in STEPS if s not in OWNER_ONLY]
    return list(STEPS)


def session_for(user):
    session, _ = OnboardingSession.objects.get_or_create(user=user)
    steps = applicable(user)
    changed = False
    for step in STEPS:
        status = session.steps.get(step)
        target = status if step in steps else "n/a"
        if status is None and step in steps:
            target = "pending"
        if step == "consent" and target == "pending" and has_consent(user, "ai"):
            target = "done"
        if step == "business" and target == "pending" and active_membership(user) is not None:
            # У существующего пользователя бизнес уже есть — шаг только уточняет его, не блокирует.
            session.answers.setdefault("business", {"kept": True})
        if target != status:
            session.steps[step], changed = target, True
    if session.completed_at is None:
        current = next((s for s in steps if session.steps.get(s) == "pending"), "summary")
        if current != session.current_step:
            session.current_step, changed = current, True
    if changed:
        session.save()
    return session


def is_done(user):
    if is_demo(user):
        return True
    return OnboardingSession.objects.filter(user=user, completed_at__isnull=False).exists()


def state(user):
    if is_demo(user):
        return {"done": True, "step": None}
    session = session_for(user)
    steps = applicable(user)
    done = [s for s in steps if session.steps.get(s) in {"done", "skipped"}]
    membership = active_membership(user)
    profile = user_profile(user)
    answers = {k: v for k, v in session.answers.items() if not k.startswith("_")}
    return {
        "done": session.completed_at is not None,
        "step": None if session.completed_at else session.current_step,
        "steps": {s: session.steps.get(s) for s in steps},
        "progress": {"done": len(done), "total": len(steps)},
        "role": membership.role if membership else None,
        "ai_consent": has_consent(user, "ai"),
        "prefill": {
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "phone": profile.phone,
            "telegram": profile.telegram,
            "channel": profile.preferred_channel,
            "language": profile.language or None,
            "brief_time": profile.brief_time.strftime("%H:%M") if profile.brief_time else None,
            "business": (
                {"id": membership.business.id, "name": membership.business.name, "segment": membership.business.segment}
                if membership
                else None
            ),
        },
        "answers": answers,
    }


# --- нормализация полей ------------------------------------------------------------------------


def text(value, limit, code, required=False):
    if value is None:
        value = ""
    if not isinstance(value, str):
        bad(code)
    value = re.sub(r"\s+", " ", value).strip()
    if (required and not value) or len(value) > limit:
        bad(code)
    return value


def phone(value):
    digits = re.sub(r"\D", "", value or "")
    if not digits:
        return ""
    if len(digits) == 9:
        digits = "998" + digits
    if len(digits) != 12 or not digits.startswith("998"):
        bad("invalid_phone")
    return "+" + digits


def telegram(value):
    value = (value or "").strip()
    value = re.sub(r"^(https?://)?t\.me/", "", value).lstrip("@")
    if value and not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{4,31}", value):
        bad("invalid_telegram")
    return value


def tags(value, allowed, limit, code):
    if value is None:
        return []
    if not isinstance(value, list) or len(value) > limit or any(t not in allowed for t in value):
        bad(code)
    return list(dict.fromkeys(value))


def number(value, code, required=False):
    if value in (None, "") and not required:
        return 0
    try:
        result = float(value)
    except (TypeError, ValueError):
        bad(code)
    if result < 0 or result > 1e13:
        bad(code)
    return result


# --- обработчики шагов ---------------------------------------------------------------------------


def do_consent(session, user, value):
    if not isinstance(value.get("ai"), bool):
        bad("invalid_consent")
    set_consent(user, "ai", value["ai"])
    lang = value.get("language")
    if lang is not None:
        if lang not in LANGS:
            bad("invalid_language")
        profile = user_profile(user)
        profile.language = lang
        profile.save(update_fields=["language", "updated_at"])
    return {"ai": value["ai"]}


def do_name(session, user, value):
    first = text(value.get("first_name"), 60, "invalid_name", required=True)
    last = text(value.get("last_name"), 60, "invalid_name")
    user.first_name, user.last_name = first, last
    user.save(update_fields=["first_name", "last_name"])
    return {"first_name": first, "last_name": last}


def do_contact(session, user, value):
    profile = user_profile(user)
    profile.phone = phone(value.get("phone"))
    profile.telegram = telegram(value.get("telegram"))
    channel = value.get("channel") or UserProfile.Channel.APP
    if channel not in UserProfile.Channel.values:
        bad("invalid_channel")
    profile.preferred_channel = channel
    profile.save()
    email = (value.get("email") or "").strip().lower()
    if email:
        try:
            validate_email(email)
        except ValidationError:
            bad("invalid_email")
        if not user.email:  # email — логин; уже подтверждённый не меняем из чата
            user.email = email
            user.save(update_fields=["email"])
    return {"phone": profile.phone, "telegram": profile.telegram, "channel": channel, "email": user.email or email}


def from_lookup(user, value):
    try:
        row = RegistryLookup.objects.get(id=int(value["lookup_id"]), user=user)
        card = row.candidates[int(value.get("index", 0))]
    except (KeyError, TypeError, ValueError, IndexError, RegistryLookup.DoesNotExist):
        bad("invalid_lookup")
    return {**card, "source": row.source}


def do_business(session, user, value):
    membership = active_membership(user)
    if value.get("keep"):
        if membership is None:
            bad("business_required")
        return {"kept": True, "name": membership.business.name}
    card = from_lookup(user, value) if value.get("lookup_id") is not None else {}
    stage = value.get("stage") or "running"
    if stage not in STAGES:
        bad("invalid_stage")
    name = text(value.get("name") or card.get("name"), 120, "invalid_name", required=True)
    inn = re.sub(r"\D", "", str(value.get("inn") or card.get("inn") or ""))
    if inn and len(inn) != 9:
        bad("invalid_inn")
    legal_form = value.get("legal_form") or ""
    if legal_form and legal_form not in LEGAL_FORMS:
        bad("invalid_legal_form")
    city = text(value.get("city"), 80, "invalid_city")
    if membership is None:
        business = create_business(user, name, industry=card.get("activity", "")[:120], city=city)
    else:
        business = membership.business
        business.name = name
        if city:
            business.city = city
        if card.get("activity") and not business.industry:
            business.industry = card["activity"][:120]
        business.save()
    session.business = business
    bp = BusinessProfile.objects.get_or_create(business=business)[0]
    if inn:
        bp.inn = inn
    if card.get("activity") and not bp.activity:
        bp.activity = card["activity"][:300]
    bp.save()
    return {
        "name": name,
        "inn": inn,
        "legal_form": legal_form,
        "city": city,
        "stage": stage,
        "source": card.get("source") or "manual",
        "director": card.get("director", ""),
        "address": card.get("address", ""),
    }


def plan_result(plan):
    """Юнит-экономика для бизнеса «в планах»: маржа, прибыль, точка безубыточности, окупаемость."""
    price = number(plan.get("price"), "invalid_plan", required=True)
    cost = number(plan.get("unit_cost"), "invalid_plan")
    units = number(plan.get("units_per_month"), "invalid_plan")
    fixed = number(plan.get("fixed_costs_per_month"), "invalid_plan")
    startup = number(plan.get("startup_costs"), "invalid_plan")
    margin = price - cost
    profit = margin * units - fixed
    return {
        "price": price,
        "unit_cost": cost,
        "units_per_month": units,
        "fixed_costs_per_month": fixed,
        "startup_costs": startup,
        "margin": margin,
        "monthly_profit": profit,
        "breakeven_units": math.ceil(fixed / margin) if margin > 0 else None,
        "payback_months": round(startup / profit, 1) if profit > 0 and startup else None,
    }


def business_of(session, user):
    membership = active_membership(user)
    return (membership.business if membership else None), (membership.role if membership else None)


def do_activity(session, user, value):
    business, _ = business_of(session, user)
    if business is None:
        bad("business_required")
    segment = value.get("segment") or ""
    if segment and segment not in SEGMENTS:
        bad("invalid_segment")
    description = text(value.get("description"), 300, "invalid_description")
    channels = tags(value.get("channels"), CHANNELS, len(CHANNELS), "invalid_channels")
    team = value.get("team_size") or ""
    if team and team not in TEAM:
        bad("invalid_team_size")
    result = {"segment": segment, "description": description, "channels": channels, "team_size": team}
    if isinstance(value.get("plan"), dict):
        result["plan"] = plan_result(value["plan"])
    if segment:
        business.segment = segment
        business.save(update_fields=["segment"])
    bp = BusinessProfile.objects.get_or_create(business=business)[0]
    if description:
        bp.activity = description
        bp.save(update_fields=["activity"])
    return result


def do_tags(catalog, limit, code):
    def handler(session, user, value):
        chosen = tags(value.get("tags"), catalog, limit, code)
        other = text(value.get("other"), 200, code)
        if not chosen and not other:
            bad(code)
        return {"tags": chosen, "other": other}

    return handler


def do_upload(session, user, value):
    source = value.get("source")
    if source not in UPLOAD_SOURCES:
        bad("invalid_upload")
    return {"source": source, "import_id": value.get("import_id") if source == "import" else None}


def do_invite(session, user, value):
    ids = value.get("invite_ids") or []
    if not isinstance(ids, list):
        bad("invalid_invite")
    return {"invites": len(ids)}


def do_install(session, user, value):
    profile = user_profile(user)
    if value.get("installed"):
        profile.pwa_installed_at = profile.pwa_installed_at or timezone.now()
    else:
        profile.install_prompt_dismissed_at = timezone.now()
    profile.save()
    return {"installed": bool(value.get("installed"))}


def do_tour(session, user, value):
    raw = value.get("brief_time")
    profile = user_profile(user)
    if raw:
        match = re.fullmatch(r"([01]\d|2[0-3]):([0-5]\d)", str(raw))
        if not match:
            bad("invalid_brief_time")
        profile.brief_time = time(int(match[1]), int(match[2]))
        profile.save(update_fields=["brief_time", "updated_at"])
    return {"brief_time": raw or None}


def do_summary(session, user, value):
    if active_membership(user) is None:
        bad("business_required")
    if any(session.steps.get(s) == "pending" for s in REQUIRED - {"summary"}):
        bad("steps_pending")
    session.completed_at = timezone.now()
    return {}


HANDLERS = {
    "consent": do_consent,
    "name": do_name,
    "contact": do_contact,
    "business": do_business,
    "activity": do_activity,
    "pains": do_tags(PAINS, 3, "invalid_pains"),
    "goals": do_tags(GOALS, 2, "invalid_goals"),
    "upload": do_upload,
    "invite": do_invite,
    "install": do_install,
    "tour": do_tour,
    "summary": do_summary,
}


# --- память ИИ -----------------------------------------------------------------------------------


def labels(catalog, answer):
    items = [catalog[t] for t in answer.get("tags", [])]
    if answer.get("other"):
        items.append(answer["other"])
    return ", ".join(items)


def desired_facts(session, user):
    """{ключ: (scope, текст)} — то, что онбординг хочет видеть в памяти ИИ."""
    a, facts = session.answers, {}
    contact = a.get("contact")
    if contact:
        parts = [f"телефон {contact['phone']}" if contact.get("phone") else "", f"Telegram @{contact['telegram']}" if contact.get("telegram") else ""]
        parts = [p for p in parts if p]
        facts["contact"] = ("user", f"Контакты: {', '.join(parts) or 'не указаны'}; удобный канал связи — {contact.get('channel', 'app')}")
    tour = a.get("tour")
    if tour and tour.get("brief_time"):
        facts["brief_time"] = ("user", f"Утреннюю сводку присылать в {tour['brief_time']}")
    activity = a.get("activity")
    if activity:
        if activity.get("channels"):
            facts["channels"] = ("business", f"Каналы продаж: {', '.join(activity['channels'])}")
        if activity.get("team_size"):
            facts["team"] = ("business", f"Команда: {TEAM[activity['team_size']]}")
        plan = activity.get("plan")
        if plan:
            facts["plan"] = (
                "business",
                f"План: цена {plan['price']:.0f}, себестоимость {plan['unit_cost']:.0f}, "
                f"прибыль в месяц {plan['monthly_profit']:.0f} сум",
            )
    business = a.get("business")
    if business and business.get("stage") == "idea":
        facts["stage"] = ("business", "Бизнес ещё в планах, не запущен")
    if a.get("pains"):
        facts["pains"] = ("business", f"Главные боли: {labels(PAINS, a['pains'])}")
    if a.get("goals"):
        facts["goals"] = ("business", f"Цели на 3 месяца: {labels(GOALS, a['goals'])}")
    return facts


def sync_memory(session, user):
    business, role = business_of(session, user)
    if business is None:
        return
    stored = session.answers.setdefault("_facts", {})
    for key, (scope, fact_text) in desired_facts(session, user).items():
        fact_text = fact_text[:300]
        old = stored.get(key)
        if old and old.get("text") == fact_text:
            continue
        if old and old.get("id"):
            memory.forget(business, user, role, old["id"])
        result = memory.remember(business, user, role, scope, fact_text, source="onboarding")
        if result.get("ok"):
            stored[key] = {"id": result["fact"]["id"], "text": fact_text}
    bp = BusinessProfile.objects.filter(business=business).first()
    if bp is None and role == OWNER:
        bp = BusinessProfile.objects.create(business=business)
    if bp is not None and role == OWNER:
        a = session.answers
        if a.get("pains"):
            bp.problems = labels(PAINS, a["pains"])[:2000]
        plan_lines = []
        if a.get("goals"):
            plan_lines.append("Цели: " + labels(GOALS, a["goals"]))
        plan = (a.get("activity") or {}).get("plan")
        if plan and plan.get("breakeven_units"):
            plan_lines.append(f"Точка безубыточности: {plan['breakeven_units']} ед./мес")
        if plan_lines:
            bp.plans = "\n".join(plan_lines)[:2000]
        bp.save()


# --- вход ----------------------------------------------------------------------------------------


def answer(user, step, action, value):
    if is_demo(user):
        bad("demo_business")
    if step not in STEPS:
        bad("invalid_step")
    if action not in {"submit", "skip"}:
        bad("invalid_action")
    if value is not None and not isinstance(value, dict):
        bad("invalid_value")
    with transaction.atomic():
        session = session_for(user)
        session = OnboardingSession.objects.select_for_update().get(pk=session.pk)
        if session.steps.get(step) == "n/a":
            bad("step_not_applicable")
        if action == "skip":
            if step in REQUIRED:
                bad("step_required")
            session.steps[step] = "skipped"
        else:
            session.answers[step] = HANDLERS[step](session, user, value or {})
            session.steps[step] = "done"
        sync_memory(session, user)
        session.save()
    session_for(user)  # пересчёт текущего шага: состав шагов зависит от роли, появившейся на шаге «бизнес»
    return state(user)
