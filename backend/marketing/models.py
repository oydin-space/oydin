from django.db import models


class Testimonial(models.Model):
    name = models.CharField(max_length=120)
    position = models.CharField(max_length=120, blank=True)
    company = models.CharField(max_length=120, blank=True)
    text_ru = models.TextField()
    text_uz = models.TextField(blank=True)
    text_en = models.TextField(blank=True)
    photo = models.BinaryField(null=True, blank=True, editable=False)
    photo_type = models.CharField(max_length=20, blank=True, editable=False)
    logo = models.BinaryField(null=True, blank=True, editable=False)
    logo_type = models.CharField(max_length=20, blank=True, editable=False)
    order = models.IntegerField(default=0)
    published = models.BooleanField(default=True)
    created = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["order", "id"]

    def __str__(self):
        return f"{self.name} — {self.company}"

    def text_for(self, lang):
        return (getattr(self, f"text_{lang}", "") if lang in ("uz", "en") else "") or self.text_ru
