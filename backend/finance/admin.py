from django.contrib import admin

from . import models


@admin.register(models.Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ("name", "business", "kind", "currency")
    list_filter = ("kind", "currency")
    search_fields = ("name", "business__name")


@admin.register(models.Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ("date", "business", "direction", "amount", "account", "purpose", "status", "source", "created_by")
    list_filter = ("direction", "purpose", "status", "source")
    search_fields = ("note", "counterparty", "category", "business__name")
    date_hierarchy = "date"
    raw_id_fields = ("account", "transfer_account", "created_by")


@admin.register(models.Obligation)
class ObligationAdmin(admin.ModelAdmin):
    list_display = ("title", "business", "kind", "amount", "due_date")
    list_filter = ("kind",)
    search_fields = ("title", "business__name")


@admin.register(models.Envelope)
class EnvelopeAdmin(admin.ModelAdmin):
    list_display = ("__str__", "business")
    search_fields = ("business__name",)


@admin.register(models.Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ("__str__", "business")
    search_fields = ("name", "business__name")


@admin.register(models.Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ("__str__", "business")
    search_fields = ("business__name",)


@admin.register(models.ExchangeRate)
class ExchangeRateAdmin(admin.ModelAdmin):
    list_display = ("date", "currency", "rate", "source", "fetched_at")
    list_filter = ("currency", "source")
    date_hierarchy = "date"
