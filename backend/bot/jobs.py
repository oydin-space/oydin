"""Уведомления: сводка, алерт о разрыве, недельный дайджест, налоговые напоминания."""

import logging
from datetime import timedelta

from django.db import IntegrityError, transaction
from django.utils import timezone

from accounts.access import FINANCE_READERS, active_membership
from finance import services as fin
from finance.domain import forecast as fc
from finance.models import Obligation
from planning.models import TaxReminder

from . import client, texts
from .models import NotificationSettings, SentNotification, TelegramLink

log = logging.getLogger(__name__)
GAP_HORIZON_DAYS = 14
GAP_RESEND = timedelta(days=3)


def brief_text(business, lang):
    p = fin.pulse(business)
    now = fin.today()
    due = [(o.title, o.amount) for o in Obligation.objects.filter(business=business, due_date=now).exclude(status="paid")]
    gap = (p["gap"]["date"], p["gap"]["amount"]) if p["gap"] else None
    if gap:
        gap = (type(now).fromisoformat(gap[0]), gap[1])
    return texts.build_brief(lang, p["balance"], p["safe_to_spend"], due, gap)


def nearest_gap(business, now):
    b = fin.bundle(business, 30, now)
    gap = fc.find_gap(b.points, b.flows, now, horizon=GAP_HORIZON_DAYS)
    return gap


def weekly_text(business, lang):
    data = fin.analytics(business, "week")
    top = [(c["label"], c["value"]) for c in data["by_category"]]
    return texts.build_weekly(lang, data["revenue"], data["expenses"], top)


def _deliver(link, business, kind, key, text, *, refresh=False):
    """Шлёт один раз на (kind, key); refresh — повторная отправка обновляет метку времени. Возвращает, ушло ли."""
    now = timezone.now()
    row = SentNotification.objects.filter(user=link.user, business=business, kind=kind, key=key).first()
    if row and not refresh:
        return False
    if row:
        # claim: сдвигаем метку только если её никто не успел поменять
        if SentNotification.objects.filter(pk=row.pk, sent_at=row.sent_at).update(sent_at=now) != 1:
            return False
    else:
        try:
            with transaction.atomic():
                row = SentNotification.objects.create(user=link.user, business=business, kind=kind, key=key, sent_at=now)
        except IntegrityError:
            return False
    previous = row.sent_at if row.sent_at != now else None
    try:
        client.call("sendMessage", {"chat_id": link.chat_id, "text": text})
    except client.BotError as exc:
        if previous is None:
            SentNotification.objects.filter(pk=row.pk).delete()
        else:
            SentNotification.objects.filter(pk=row.pk).update(sent_at=previous)
        if exc.status == 403:
            link.delete()
        log.warning("bot send failed: %s", exc)
        return False
    return True


def run_tick(now=None):
    """Один проход по всем привязанным чатам; безопасно вызывать сколько угодно раз."""
    now = timezone.localtime(now or timezone.now())
    sent = 0
    for link in TelegramLink.objects.select_related("user"):
        try:
            sent += _tick_link(link, now)
        except Exception:
            log.exception("bot job failed for user %s", link.user_id)
    return sent


def _tick_link(link, now):
    membership = active_membership(link.user)
    if membership is None or membership.role not in FINANCE_READERS:
        return 0
    business, lang = membership.business, link.lang
    prefs = NotificationSettings.objects.filter(user=link.user, business=business).first() or NotificationSettings()
    day, sent = now.date(), 0
    if prefs.daily_brief and now.hour >= prefs.brief_hour:
        sent += _deliver(link, business, "daily_brief", day.isoformat(), brief_text(business, lang))
    if prefs.gap_alerts:
        gap = nearest_gap(business, day)
        if gap:
            text = texts.build_gap_alert(lang, gap.date, gap.amount)
            key = gap.date.isoformat()
            row = SentNotification.objects.filter(user=link.user, business=business, kind="gap_alert", key=key).first()
            if row is None or now - timezone.localtime(row.sent_at) >= GAP_RESEND:
                sent += _deliver(link, business, "gap_alert", key, text, refresh=True)
    if prefs.weekly_digest and day.weekday() == 0 and now.hour >= prefs.brief_hour:
        year, week, _ = day.isocalendar()
        sent += _deliver(link, business, "weekly_digest", f"{year}-W{week:02d}", weekly_text(business, lang))
    if prefs.tax_reminders:
        for days in (3, 0):
            due = day + timedelta(days=days)
            for r in TaxReminder.objects.filter(business=business, due_date=due, status=TaxReminder.Status.PLANNED):
                text = texts.build_tax(lang, r.title, r.due_date, r.amount, days)
                sent += _deliver(link, business, "tax_reminder", f"{r.id}:{days}", text)
    return sent
