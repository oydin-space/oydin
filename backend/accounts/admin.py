import csv

from django.apps import apps
from django.contrib import admin, messages
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.db.models import Count, Max
from django.http import HttpResponse
from django.urls import reverse
from django.utils.html import format_html

from .models import Business, EmailCode, Membership, Profile

User = get_user_model()


def _model(app, name):
    """Модель другого приложения или None, если приложения нет (мягкая зависимость)."""
    try:
        return apps.get_model(app, name)
    except LookupError:
        return None


class ProfileInline(admin.StackedInline):
    model = Profile
    can_delete = False
    fk_name = "user"
    fields = ("business", "telegram_id", "google_sub")
    readonly_fields = ("google_sub",)


class MembershipInline(admin.TabularInline):
    model = Membership
    fk_name = "user"
    extra = 0
    fields = ("business", "role", "invited_email", "created_at")
    readonly_fields = ("created_at",)


admin.site.unregister(User)


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    inlines = (ProfileInline, MembershipInline)
    list_display = (
        "username", "email", "first_name", "contacts", "businesses", "auth_method",
        "is_active", "is_staff", "date_joined", "last_login",
    )
    list_filter = ("is_active", "is_staff", "is_superuser", "date_joined", "last_login")
    search_fields = (
        "username", "email", "first_name", "last_name", "profile__telegram_id",
        "onboarding_profile__phone", "onboarding_profile__telegram",
    )
    actions = ("export_csv", "block_users", "unblock_users", "deactivate_users")

    def get_queryset(self, request):
        return (
            super().get_queryset(request)
            .select_related("profile", "onboarding_profile")
            .prefetch_related("memberships__business")
        )

    @admin.display(description="Контакты")
    def contacts(self, obj):
        op = getattr(obj, "onboarding_profile", None)
        parts = []
        if op and op.telegram:
            parts.append(f"@{op.telegram.lstrip('@')}")
        if op and op.phone:
            parts.append(op.phone)
        return ", ".join(parts) or "—"

    @admin.display(description="Бизнесы и роли")
    def businesses(self, obj):
        return ", ".join(f"{m.business.name} ({m.role})" for m in obj.memberships.all()) or "—"

    @admin.display(description="Вход")
    def auth_method(self, obj):
        profile = getattr(obj, "profile", None)
        methods = []
        if profile and profile.google_sub:
            methods.append("google")
        if profile and profile.telegram_id:
            methods.append("telegram")
        if obj.email and not methods:
            methods.append("email")
        return ", ".join(methods) or "—"

    @admin.action(description="Экспорт выбранных в CSV")
    def export_csv(self, request, queryset):
        response = HttpResponse(content_type="text/csv; charset=utf-8")
        response["Content-Disposition"] = 'attachment; filename="users.csv"'
        writer = csv.writer(response)
        writer.writerow(
            ["id", "email", "name", "contacts", "businesses", "date_joined", "last_login", "auth_method", "is_active"]
        )
        for u in queryset.order_by("id"):
            writer.writerow([
                u.pk, u.email, f"{u.first_name} {u.last_name}".strip(), self.contacts(u), self.businesses(u),
                u.date_joined.isoformat(), u.last_login.isoformat() if u.last_login else "",
                self.auth_method(u), u.is_active,
            ])
        return response

    @admin.action(description="Заблокировать выбранных")
    def block_users(self, request, queryset):
        count = queryset.exclude(pk=request.user.pk).update(is_active=False)
        self.message_user(request, f"Заблокировано: {count}", messages.SUCCESS)

    @admin.action(description="Разблокировать выбранных")
    def unblock_users(self, request, queryset):
        count = queryset.update(is_active=True)
        self.message_user(request, f"Разблокировано: {count}", messages.SUCCESS)

    @admin.action(description="Деактивировать выбранных пользователей")
    def deactivate_users(self, request, queryset):
        count = queryset.exclude(pk=request.user.pk).update(is_active=False)
        self.message_user(request, f"Деактивировано: {count}", messages.SUCCESS)


class BusinessMembershipInline(admin.TabularInline):
    model = Membership
    fk_name = "business"
    extra = 0
    autocomplete_fields = ("user",)
    fields = ("user", "role", "invited_email", "created_at")
    readonly_fields = ("created_at",)


class MemoryFactInline(admin.TabularInline):
    """Факты, которые ИИ помнит о бизнесе: только просмотр и удаление."""

    model = _model("ai", "MemoryFact")
    extra = 0
    fields = ("scope", "text", "source", "created_at")
    readonly_fields = fields
    can_delete = True

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


class BusinessProfileInline(admin.StackedInline):
    model = _model("ai", "BusinessProfile")
    extra = 0
    can_delete = False
    fields = ("inn", "activity", "plans", "problems")
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = (
        "id", "name", "industry", "city", "tax_regime", "is_demo", "owner_contact",
        "created", "ops_count", "last_activity", "plan", "open_data",
    )
    list_filter = ("is_demo", "tax_regime", "city")
    search_fields = ("name", "industry", "city")
    inlines = (BusinessMembershipInline, BusinessProfileInline, MemoryFactInline)
    readonly_fields = ("open_data",)

    def get_queryset(self, request):
        return (
            super().get_queryset(request)
            .annotate(
                _ops=Count("transactions", distinct=True),
                _last=Max("transactions__created_at"),
                _created=Max("memberships__created_at"),
            )
            .prefetch_related("memberships__user")
        )

    @admin.display(description="Владелец")
    def owner_contact(self, obj):
        for m in obj.memberships.all():
            if m.role == Membership.Role.OWNER and m.user:
                return m.user.email or m.user.username
        return "—"

    @admin.display(description="Создан", ordering="_created")
    def created(self, obj):
        return obj._created

    @admin.display(description="Операций", ordering="_ops")
    def ops_count(self, obj):
        return obj._ops

    @admin.display(description="Последняя активность", ordering="_last")
    def last_activity(self, obj):
        return obj._last

    @admin.display(description="Тариф")
    def plan(self, obj):
        sub = _model("billing", "Subscription")
        if sub is None:
            return "—"
        try:
            row = sub.objects.filter(business=obj).first()
        except Exception:
            return "—"
        if row is None:
            return "free"
        return str(getattr(row, "plan", None) or "—")

    @admin.display(description="Данные")
    def open_data(self, obj):
        if not obj.pk:
            return "—"
        return format_html('<a href="{}">Открыть данные бизнеса</a>', reverse("adminx_business_data", args=[obj.pk]))


@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ("user", "business", "telegram_id", "google_sub")
    search_fields = ("user__username", "user__email", "telegram_id", "business__name")
    list_select_related = ("user", "business")
    autocomplete_fields = ("user", "business")


@admin.register(Membership)
class MembershipAdmin(admin.ModelAdmin):
    list_display = ("id", "business", "user", "role", "invited_email", "created_at")
    list_filter = ("role", "business__is_demo")
    search_fields = ("business__name", "user__username", "user__email", "invited_email")
    list_select_related = ("user", "business")
    autocomplete_fields = ("user", "business")


@admin.register(EmailCode)
class EmailCodeAdmin(admin.ModelAdmin):
    # Только просмотр: хеш кода не секрет без SECRET_KEY, но редактировать тут нечего.
    list_display = ("email", "created_at", "expires_at", "attempts", "used")
    list_filter = ("used",)
    search_fields = ("email",)
    readonly_fields = ("email", "code_hash", "created_at", "expires_at", "attempts", "used")

    def has_add_permission(self, request):
        return False
