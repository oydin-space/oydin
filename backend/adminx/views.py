"""Операторская консоль: метрики и просмотр данных бизнеса (только чтение, только staff)."""

from datetime import timedelta

from django.apps import apps
from django.contrib import admin
from django.contrib.admin.views.decorators import staff_member_required
from django.contrib.auth import get_user_model
from django.db.models import Count
from django.db.models.functions import TruncDate
from django.shortcuts import get_object_or_404
from django.template.response import TemplateResponse
from django.utils import timezone

from accounts.models import Business, Invite, Membership
from connectors.models import Connector
from finance.models import Transaction
from onboarding.models import OnboardingSession

BUGSINK_URL = "https://bugsink.oydin.sayfi.uz"
DOCS_URL = "https://docs.oydin.sayfi.uz"


def _bars(series, width=640, height=140):
    """series: [(label, value)] -> данные для inline SVG."""
    peak = max([v for _, v in series] + [1])
    n = max(len(series), 1)
    step = width / n
    out = []
    for i, (label, value) in enumerate(series):
        h = round((height - 20) * value / peak)
        out.append({"x": round(i * step + 2, 1), "w": round(step - 4, 1), "y": height - 16 - h, "h": h, "label": label, "value": value})
    return {"bars": out, "width": width, "height": height}


def _signups(now, days=30):
    User = get_user_model()
    start = (now - timedelta(days=days - 1)).date()
    rows = dict(
        User.objects.filter(date_joined__date__gte=start)
        .annotate(d=TruncDate("date_joined"))
        .values_list("d")
        .annotate(c=Count("id"))
    )
    return [((start + timedelta(days=i)), rows.get(start + timedelta(days=i), 0)) for i in range(days)]


@staff_member_required
def metrics(request):
    User = get_user_model()
    now = timezone.now()

    def active(days):
        login = set(User.objects.filter(last_login__gte=now - timedelta(days=days)).values_list("id", flat=True))
        ops = set(
            Transaction.objects.filter(created_at__gte=now - timedelta(days=days), created_by__isnull=False)
            .values_list("created_by_id", flat=True)
        )
        return len(login | ops)

    signups = _signups(now)
    sessions = OnboardingSession.objects.all()
    funnel = [
        ("Регистрации", User.objects.count()),
        ("Начали знакомство", sessions.count()),
        ("Дошли до бизнеса", sessions.filter(business__isnull=False).count()),
        ("Завершили", sessions.filter(completed_at__isnull=False).count()),
    ]
    by_source = dict(Transaction.objects.values_list("source").annotate(c=Count("id")))
    month = now - timedelta(days=30)
    recent_src = dict(Transaction.objects.filter(created_at__gte=month).values_list("source").annotate(c=Count("id")))
    invites = Invite.objects.all()
    ctx = {
        **admin.site.each_context(request),
        "title": "Метрики Oydin",
        "users_total": User.objects.count(),
        "businesses_total": Business.objects.filter(is_demo=False).count(),
        "signups_chart": _bars([(d.strftime("%d.%m"), c) for d, c in signups]),
        "signups_30d": sum(c for _, c in signups),
        "dau": active(1),
        "wau": active(7),
        "mau": active(30),
        "funnel": funnel,
        "funnel_peak": max([v for _, v in funnel] + [1]),
        "ai_voice_total": by_source.get(Transaction.Source.VOICE, 0),
        "ai_chat_total": by_source.get(Transaction.Source.CHAT, 0),
        "ai_voice_30d": recent_src.get(Transaction.Source.VOICE, 0),
        "ai_chat_30d": recent_src.get(Transaction.Source.CHAT, 0),
        "connectors_total": Connector.objects.count(),
        "invites_total": invites.count(),
        "invites_used": sum(invites.values_list("uses", flat=True)),
        "invites_revoked": invites.filter(revoked_at__isnull=False).count(),
        "invites_active": invites.filter(revoked_at__isnull=True, expires_at__gt=now).count(),
        "bugsink_url": BUGSINK_URL,
        "docs_url": DOCS_URL,
    }
    return TemplateResponse(request, "admin/oydin_dashboard.html", ctx)


@staff_member_required
def business_data(request, business_id):
    business = get_object_or_404(Business, pk=business_id)
    ops = Transaction.objects.filter(business=business).select_related("account", "created_by").order_by("-created_at")[:100]
    ctx = {
        **admin.site.each_context(request),
        "title": f"Данные бизнеса: {business.name} (только чтение)",
        "business": business,
        "ops": ops,
        "members": Membership.objects.filter(business=business).select_related("user"),
    }
    return TemplateResponse(request, "admin/oydin_business_data.html", ctx)
