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
            name="Connector",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(choices=[("mcp", "Mcp"), ("rest", "Rest")], max_length=8)),
                ("name", models.CharField(max_length=60)),
                ("description", models.CharField(blank=True, max_length=500)),
                ("url", models.CharField(max_length=500)),
                ("method", models.CharField(blank=True, max_length=6)),
                ("params_schema", models.JSONField(blank=True, default=dict)),
                ("auth_header", models.CharField(blank=True, max_length=60)),
                ("auth_secret_enc", models.TextField(blank=True)),
                ("tools_cache", models.JSONField(blank=True, default=list)),
                ("enabled", models.BooleanField(default=True)),
                ("last_test_ok", models.BooleanField(blank=True, null=True)),
                ("last_test_error", models.CharField(blank=True, max_length=200)),
                ("last_test_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="connectors", to="accounts.business")),
                ("created_by", models.ForeignKey(null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["id"]},
        ),
    ]
