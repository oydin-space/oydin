import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
        ("accounts", "0003_owner_memberships"),
        ("finance", "0002_account_currency_transaction_created_by_and_more"),
    ]

    operations = [
        migrations.CreateModel(
            name="ImportJob",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("kind", models.CharField(choices=[("csv", "Csv"), ("xlsx", "Xlsx"), ("1c_bank", "Bank 1C"), ("commerceml", "Commerceml")], max_length=12)),
                ("filename", models.CharField(max_length=255)),
                ("status", models.CharField(choices=[("preview", "Preview"), ("committed", "Committed"), ("failed", "Failed")], default="preview", max_length=10)),
                ("columns", models.JSONField(default=list)),
                ("rows", models.JSONField(default=list)),
                ("mapping", models.JSONField(default=dict)),
                ("mapping_confidence", models.FloatField(default=0)),
                ("signature", models.CharField(max_length=40)),
                ("created_count", models.IntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("account", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="+", to="finance.account")),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="import_jobs", to="accounts.business")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="import_jobs", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-id"]},
        ),
        migrations.CreateModel(
            name="ImportMapping",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("signature", models.CharField(max_length=40)),
                ("mapping", models.JSONField(default=dict)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="import_mappings", to="accounts.business")),
            ],
        ),
        migrations.AddConstraint(
            model_name="importmapping",
            constraint=models.UniqueConstraint(fields=("business", "signature"), name="import_mapping_signature"),
        ),
    ]
