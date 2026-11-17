from django.contrib import admin

from .models import LinkCode, NotificationSettings, SentNotification, TelegramLink


@admin.register(TelegramLink)
class TelegramLinkAdmin(admin.ModelAdmin):
    list_display = ("user", "chat_id", "username", "lang", "created_at")
    search_fields = ("user__username", "username", "chat_id")


@admin.register(LinkCode)
class LinkCodeAdmin(admin.ModelAdmin):
    list_display = ("user", "expires_at", "created_at")
    exclude = ("code_hash",)


@admin.register(NotificationSettings)
class NotificationSettingsAdmin(admin.ModelAdmin):
    list_display = ("user", "business", "daily_brief", "gap_alerts", "weekly_digest", "tax_reminders", "brief_hour")


@admin.register(SentNotification)
class SentNotificationAdmin(admin.ModelAdmin):
    list_display = ("user", "business", "kind", "key", "sent_at")
    list_filter = ("kind",)
