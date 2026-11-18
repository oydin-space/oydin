import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("accounts", "0005_business_segment"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="UserProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("language", models.CharField(blank=True, default="", max_length=2)),
                ("phone", models.CharField(blank=True, default="", max_length=16)),
                ("telegram", models.CharField(blank=True, default="", max_length=64)),
                (
                    "preferred_channel",
                    models.CharField(
                        choices=[("app", "App"), ("telegram", "Telegram"), ("email", "Email")], default="app", max_length=10
                    ),
                ),
                ("brief_time", models.TimeField(blank=True, null=True)),
                ("pwa_installed_at", models.DateTimeField(blank=True, null=True)),
                ("install_prompt_dismissed_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="onboarding_profile",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="OnboardingSession",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("current_step", models.CharField(default="consent", max_length=20)),
                ("steps", models.JSONField(default=dict)),
                ("answers", models.JSONField(default=dict)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "business",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to="accounts.business",
                    ),
                ),
                (
                    "user",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="onboarding_session",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
        ),
        migrations.CreateModel(
            name="RegistryLookup",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(db_index=True, max_length=64)),
                ("kind", models.CharField(max_length=8)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("found", "Found"),
                            ("multiple", "Multiple"),
                            ("not_found", "Not Found"),
                            ("unavailable", "Unavailable"),
                        ],
                        max_length=12,
                    ),
                ),
                ("source", models.CharField(blank=True, default="", max_length=20)),
                ("candidates", models.JSONField(default=list)),
                ("fetched_at", models.DateTimeField()),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "user",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="registry_lookups",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"ordering": ["-id"]},
        ),
    ]
