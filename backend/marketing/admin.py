from django import forms
from django.contrib import admin
from django.urls import reverse
from django.utils.html import format_html

from .images import read_image
from .models import Testimonial


class TestimonialForm(forms.ModelForm):
    photo_upload = forms.FileField(required=False, label="Фото (PNG/JPEG/WebP, ≤1 МБ)")
    logo_upload = forms.FileField(required=False, label="Логотип (PNG/JPEG/WebP, ≤1 МБ)")

    class Meta:
        model = Testimonial
        fields = ["name", "position", "company", "text_ru", "text_uz", "text_en", "order", "published"]

    def _image(self, field):
        upload = self.cleaned_data.get(field)
        return read_image(upload) if upload else None

    def clean_photo_upload(self):
        self._photo = self._image("photo_upload")
        return self.cleaned_data.get("photo_upload")

    def clean_logo_upload(self):
        self._logo = self._image("logo_upload")
        return self.cleaned_data.get("logo_upload")

    def save(self, commit=True):
        obj = super().save(commit=False)
        for attr, found in (("photo", getattr(self, "_photo", None)), ("logo", getattr(self, "_logo", None))):
            if found:
                setattr(obj, attr, found[0])
                setattr(obj, f"{attr}_type", found[1])
        if commit:
            obj.save()
        return obj


@admin.register(Testimonial)
class TestimonialAdmin(admin.ModelAdmin):
    form = TestimonialForm
    list_display = ("name", "company", "photo_preview", "logo_preview", "order", "published")
    list_editable = ("order", "published")
    ordering = ("order", "id")

    def _thumb(self, obj, kind):
        if not getattr(obj, kind):
            return "—"
        url = reverse(f"testimonial_{kind}", args=[obj.pk])
        return format_html('<img src="{}" style="height:40px;max-width:80px;object-fit:contain">', url)

    @admin.display(description="Фото")
    def photo_preview(self, obj):
        return self._thumb(obj, "photo")

    @admin.display(description="Логотип")
    def logo_preview(self, obj):
        return self._thumb(obj, "logo")
