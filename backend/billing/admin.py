from django import forms
from django.contrib import admin

from .models import Payment, Plan, Subscription

LANGS = ("ru", "uz", "en")
TEXT_FIELDS = ("name", "tagline", "cta_note")
LIST_FIELDS = ("features", "new_features", "missing", "limits")
LABELS = {
    "name": "Название", "tagline": "Подзаголовок", "cta_note": "Пометка у кнопки", "features": "Что входит",
    "new_features": "Новое / премиум", "missing": "Чего нет", "limits": "Ограничения",
}


class PlanForm(forms.ModelForm):
    """Локализованные JSON-поля правятся тремя текстовыми полями (ru/uz/en); в списках — один пункт на строку."""

    class Meta:
        model = Plan
        exclude = (*TEXT_FIELDS, *LIST_FIELDS)

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        for name in (*TEXT_FIELDS, *LIST_FIELDS):
            current = getattr(self.instance, name, None) or {}
            for lang in LANGS:
                value = current.get(lang, "" if name in TEXT_FIELDS else [])
                text = value if name in TEXT_FIELDS else "\n".join(value)
                widget = forms.TextInput if name in TEXT_FIELDS else forms.Textarea
                self.fields[f"{name}_{lang}"] = forms.CharField(
                    required=False, initial=text, label=f"{LABELS[name]} ({lang})", widget=widget(attrs={"size": 80} if name in TEXT_FIELDS else {"rows": 4, "cols": 80})
                )

    def save(self, commit=True):
        obj = super().save(commit=False)
        for name in (*TEXT_FIELDS, *LIST_FIELDS):
            values = {lang: (self.cleaned_data.get(f"{name}_{lang}") or "") for lang in LANGS}
            if name in LIST_FIELDS:
                values = {lang: [line.strip() for line in text.splitlines() if line.strip()] for lang, text in values.items()}
            else:
                values = {lang: text.strip() for lang, text in values.items()}
            setattr(obj, name, values)
        if commit:
            obj.save()
            self.save_m2m()
        return obj


def localized_fieldsets():
    sets = [(None, {"fields": ("code", "order", "is_active", "is_popular", "icon", "price_uzs", "period", "image")})]
    for name in (*TEXT_FIELDS, *LIST_FIELDS):
        sets.append((LABELS[name], {"fields": tuple(f"{name}_{lang}" for lang in LANGS)}))
    return sets


@admin.register(Plan)
class PlanAdmin(admin.ModelAdmin):
    form = PlanForm
    ordering = ("order", "id")
    list_display = ("order", "code", "name_ru", "price_uzs", "is_popular", "is_active")
    list_display_links = ("code",)
    list_editable = ("order", "price_uzs", "is_popular", "is_active")

    def get_fieldsets(self, request, obj=None):
        return localized_fieldsets()

    @admin.display(description="Название (ru)")
    def name_ru(self, obj):
        return (obj.name or {}).get("ru", "")


class ReadOnlyAdmin(admin.ModelAdmin):
    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Payment)
class PaymentAdmin(ReadOnlyAdmin):
    list_display = ("id", "business", "plan", "amount_uzs", "status", "click_trans_id", "created_at", "paid_at")
    list_filter = ("status", "plan")


@admin.register(Subscription)
class SubscriptionAdmin(ReadOnlyAdmin):
    list_display = ("business", "plan", "status", "renews_at", "updated_at")
    list_filter = ("status", "plan")
