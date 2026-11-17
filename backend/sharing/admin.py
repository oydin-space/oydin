from django.contrib import admin

from .models import Partner, PartnerStaff, ShareLink

admin.site.register(Partner)
admin.site.register(PartnerStaff)


@admin.register(ShareLink)
class ShareLinkAdmin(admin.ModelAdmin):
    list_display = ("id", "business", "label", "expires_at", "revoked_at", "views")
    exclude = ("token_hash",)
