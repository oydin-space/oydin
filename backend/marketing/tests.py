from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import TestCase

from .admin import TestimonialForm
from .models import Testimonial

PNG = b"\x89PNG\r\n\x1a\n" + b"0" * 20


class TestimonialTests(TestCase):
    def test_list_published_ordered_and_fallback(self):
        Testimonial.objects.create(name="B", text_ru="ru-b", text_en="en-b", order=2)
        Testimonial.objects.create(name="A", text_ru="ru-a", order=1, photo=PNG, photo_type="image/png")
        Testimonial.objects.create(name="H", text_ru="x", published=False)
        items = self.client.get("/api/public/testimonials/?lang=en").json()["items"]
        self.assertEqual([i["name"] for i in items], ["A", "B"])
        self.assertEqual(items[0]["text"], "ru-a")
        self.assertEqual(items[1]["text"], "en-b")
        self.assertTrue(items[0]["photo"].endswith("/photo/"))
        self.assertIsNone(items[0]["logo"])

    def test_image_endpoint(self):
        t = Testimonial.objects.create(name="A", text_ru="x", photo=PNG, photo_type="image/png")
        r = self.client.get(f"/api/public/testimonials/{t.id}/photo/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r["Content-Type"], "image/png")
        self.assertEqual(r["X-Content-Type-Options"], "nosniff")
        self.assertEqual(r.content, PNG)
        self.assertEqual(self.client.get(f"/api/public/testimonials/{t.id}/logo/").status_code, 404)
        t.published = False
        t.save()
        self.assertEqual(self.client.get(f"/api/public/testimonials/{t.id}/photo/").status_code, 404)

    def _form(self, f):
        return TestimonialForm(
            {"name": "N", "text_ru": "t", "order": 0, "published": True}, {"photo_upload": f}
        )

    def test_upload_valid_stores_bytes(self):
        form = self._form(SimpleUploadedFile("a.png", PNG))
        self.assertTrue(form.is_valid(), form.errors)
        obj = form.save()
        self.assertEqual(bytes(obj.photo), PNG)
        self.assertEqual(obj.photo_type, "image/png")

    def test_upload_rejects_svg_and_oversize(self):
        svg = SimpleUploadedFile("a.svg", b"<svg onload=alert(1)></svg>")
        self.assertFalse(self._form(svg).is_valid())
        big = SimpleUploadedFile("a.png", PNG + b"0" * (1024 * 1024))
        self.assertFalse(self._form(big).is_valid())
