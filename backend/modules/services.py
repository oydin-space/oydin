import json
from datetime import timedelta

from django.db import transaction
from django.utils import timezone

from accounts.http import ApiError

from . import catalog
from .models import ModuleState, UsageEvent, WidgetConfig, WidgetProposal

USAGE_WINDOW_DAYS = 30
SIZE_ORDER = catalog.SIZES


def module_map(business):
    stored = dict(ModuleState.objects.filter(business=business).values_list("key", "enabled"))
    return {k: stored.get(k, k in catalog.DEFAULT_MODULES) for k in catalog.MODULE_KEYS}


def set_modules(business, changes):
    if not isinstance(changes, dict) or not changes:
        raise ApiError(400, "Нужен объект modules")
    for key, value in changes.items():
        if key not in catalog.MODULE_KEYS:
            raise ApiError(400, f"Неизвестный модуль: {key}")
        if not isinstance(value, bool):
            raise ApiError(400, "Значение модуля — true или false")
    if changes.get("money") is False:
        raise ApiError(400, "Модуль «Деньги» отключить нельзя")
    with transaction.atomic():
        for key, value in changes.items():
            ModuleState.objects.update_or_create(business=business, key=key, defaults={"enabled": value})


def apply_preset(business, name):
    if name not in catalog.PRESETS:
        raise ApiError(400, "Неизвестный пресет")
    on = set(catalog.PRESETS[name])
    set_modules(business, {k: k in on for k in catalog.MODULE_KEYS})


def serialize_modules(business):
    state = module_map(business)
    return {
        "modules": [{"key": k, "enabled": state[k]} for k in catalog.MODULE_KEYS],
        "presets": [{"key": k, "modules": list(v)} for k, v in catalog.PRESETS.items()],
    }


def _current(business, key):
    return WidgetConfig.objects.filter(business=business, key=key, active=True).first()


def _publish(business, key, spec, version):
    WidgetConfig.objects.filter(business=business, key=key, active=True).update(active=False)
    return WidgetConfig.objects.create(business=business, key=key, spec=spec, version=version, active=True)


def ensure_defaults(business):
    """Системные виджеты включённых модулей создаются при первом обращении (версия 1)."""
    state = module_map(business)
    for key, (module, spec) in catalog.WIDGETS.items():
        if state[module] and not WidgetConfig.objects.filter(business=business, key=key).exists():
            _publish(business, key, dict(spec), 1)


def serialize_widget(w):
    return {"key": w.key, "version": w.version, "spec": w.spec, "active": w.active, "created_at": w.created_at.isoformat()}


def active_widgets(business):
    ensure_defaults(business)
    state = module_map(business)
    rows = WidgetConfig.objects.filter(business=business, active=True)
    return [serialize_widget(w) for w in rows if state.get(catalog.WIDGETS.get(w.key, ("",))[0])]


def versions(business, key):
    rows = WidgetConfig.objects.filter(business=business, key=key).order_by("-version")
    if not rows:
        raise ApiError(404, "Виджет не найден")
    return [serialize_widget(w) for w in rows]


def record_usage(business, key, action):
    if key not in catalog.WIDGETS:
        raise ApiError(400, "Неизвестный виджет")
    if action not in catalog.USAGE_ACTIONS:
        raise ApiError(400, "Неизвестное действие")
    UsageEvent.objects.create(business=business, key=key, action=action)


def serialize_proposal(p):
    return {"id": p.id, "key": p.key, "base_version": p.base_version, "spec": p.spec, "rationale": p.rationale,
            "status": p.status, "created_by": p.created_by, "created_at": p.created_at.isoformat()}


def _latest_version(business, key):
    last = WidgetConfig.objects.filter(business=business, key=key).order_by("-version").first()
    return last.version if last else 0


def decide(business, proposal_id, approve):
    with transaction.atomic():
        p = WidgetProposal.objects.select_for_update().filter(pk=proposal_id, business=business).first()
        if p is None:
            raise ApiError(404, "Предложение не найдено")
        if p.status != WidgetProposal.Status.PENDING:
            raise ApiError(409, "Предложение уже обработано")
        if approve:
            cur = _current(business, p.key)
            if cur is None or cur.version != p.base_version:
                raise ApiError(409, "Виджет изменился после предложения")
            _publish(business, p.key, catalog.validate_spec(p.spec), _latest_version(business, p.key) + 1)
        p.status = WidgetProposal.Status.APPROVED if approve else WidgetProposal.Status.REJECTED
        p.save(update_fields=["status"])
    return p


def rollback(business, key, version):
    if isinstance(version, bool) or not isinstance(version, int):
        raise ApiError(400, "Нужен номер версии")
    with transaction.atomic():
        old = WidgetConfig.objects.filter(business=business, key=key, version=version).first()
        if old is None:
            raise ApiError(404, "Версия не найдена")
        spec = catalog.validate_spec(old.spec)
        return _publish(business, key, spec, _latest_version(business, key) + 1)


def _counts(business, since):
    out = {}
    for key, action in UsageEvent.objects.filter(business=business, ts__gte=since).values_list("key", "action"):
        out.setdefault(key, {}).setdefault(action, 0)
        out[key][action] += 1
    return out


def _heuristic(spec, c):
    """(новая спецификация, обоснование) либо None. Только числа из журнала."""
    size, opens, dismiss = spec.get("size", "m"), c.get("open", 0), c.get("dismiss", 0)
    idx = SIZE_ORDER.index(size)
    if opens >= 5 and dismiss < opens and idx < len(SIZE_ORDER) - 1:
        return {**spec, "size": SIZE_ORDER[idx + 1]}, f"За {USAGE_WINDOW_DAYS} дней виджет открывали {opens} раз: показать крупнее."
    if dismiss >= 3 and opens == 0 and idx > 0:
        return {**spec, "size": SIZE_ORDER[idx - 1]}, f"За {USAGE_WINDOW_DAYS} дней виджет скрывали {dismiss} раз и не открывали: сделать компактнее."
    return None


def _llm_candidate(key, spec, c):
    """Необязательно: модель предлагает правку; любой сбой или невалидный ответ — None."""
    from ai import llm

    if not llm.is_configured():
        return None
    system = ("Ты помогаешь настроить виджет владельца малого бизнеса по журналу использования. "
              "Верни JSON {\"spec\": {...}, \"rationale\": \"...\"}: spec — только поля "
              f"{', '.join(catalog.ALLOWED_KEYS)}; rationale — одно предложение, только по числам из журнала.")
    user = json.dumps({"key": key, "spec": spec, "usage_30d": c}, ensure_ascii=False)
    try:
        reply = llm.complete(system, [{"role": "user", "content": user}], name="widget_proposal")
        new = catalog.validate_spec(reply.get("spec"))
        rationale = str(reply.get("rationale", "")).strip()[:300]
    except Exception:
        return None
    return (new, rationale) if rationale and new != spec else None


def propose_from_usage(business, use_llm=False):
    """Создаёт предложения по журналу за 30 дней; возвращает созданные. Одно ожидающее на виджет."""
    ensure_defaults(business)
    counts = _counts(business, timezone.now() - timedelta(days=USAGE_WINDOW_DAYS))
    created = []
    for key, c in counts.items():
        cur = _current(business, key)
        if cur is None or WidgetProposal.objects.filter(business=business, key=key, status="pending").exists():
            continue
        found = _heuristic(cur.spec, c) or (_llm_candidate(key, cur.spec, c) if use_llm else None)
        if found is None:
            continue
        created.append(WidgetProposal.objects.create(business=business, key=key, base_version=cur.version,
                                                      spec=found[0], rationale=found[1]))
    return created
