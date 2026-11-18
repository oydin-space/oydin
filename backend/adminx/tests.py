from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

User = get_user_model()


class AdminxTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_superuser("root", "root@x.uz", "pw")
        self.user = User.objects.create_user("u1", "u1@x.uz", "pw")

    def test_metrics_requires_staff(self):
        self.assertEqual(self.client.get(reverse("adminx_metrics")).status_code, 302)
        self.client.force_login(self.user)
        self.assertEqual(self.client.get(reverse("adminx_metrics")).status_code, 302)

    def test_metrics_staff(self):
        self.client.force_login(self.staff)
        r = self.client.get(reverse("adminx_metrics"))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.context["users_total"], 2)
        self.assertEqual(r.context["signups_30d"], 2)
        self.assertContains(r, "<svg")

    def test_index_link(self):
        self.client.force_login(self.staff)
        self.assertContains(self.client.get("/admin/"), "/admin/metrics/")

    def test_csv_export(self):
        self.client.force_login(self.staff)
        r = self.client.post(
            reverse("admin:auth_user_changelist"),
            {"action": "export_csv", "_selected_action": [self.user.pk]},
        )
        self.assertEqual(r.status_code, 200)
        self.assertIn("text/csv", r["Content-Type"])
        self.assertIn("u1@x.uz", r.content.decode())

    def test_block_unblock(self):
        self.client.force_login(self.staff)
        url = reverse("admin:auth_user_changelist")
        self.client.post(url, {"action": "block_users", "_selected_action": [self.user.pk]})
        self.user.refresh_from_db()
        self.assertFalse(self.user.is_active)
        self.client.post(url, {"action": "unblock_users", "_selected_action": [self.user.pk]})
        self.user.refresh_from_db()
        self.assertTrue(self.user.is_active)

    def test_business_data(self):
        from accounts.models import Business

        b = Business.objects.create(name="Shop")
        self.client.force_login(self.staff)
        r = self.client.get(reverse("adminx_business_data", args=[b.pk]))
        self.assertEqual(r.status_code, 200)
        self.assertEqual(self.client.get(reverse("adminx_business_data", args=[999])).status_code, 404)
