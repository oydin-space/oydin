from django.contrib import admin, messages
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Business, EmailCode, Membership, Profile

User = get_user_model()


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
    list_display = ("username", "email", "first_name", "is_active", "is_staff", "date_joined", "last_login")
    list_filter = ("is_active", "is_staff", "is_superuser", "date_joined")
    search_fields = ("username", "email", "first_name", "last_name", "profile__telegram_id")
    actions = ("deactivate_users",)

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


@admin.register(Business)
class BusinessAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "industry", "city", "tax_regime", "is_demo")
    list_filter = ("is_demo", "tax_regime", "city")
    search_fields = ("name", "industry", "city")
    inlines = (BusinessMembershipInline,)


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
