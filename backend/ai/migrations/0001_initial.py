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
            name="BusinessProfile",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("inn", models.CharField(blank=True, default="", max_length=20)),
                ("activity", models.CharField(blank=True, default="", max_length=300)),
                ("plans", models.TextField(blank=True, default="")),
                ("problems", models.TextField(blank=True, default="")),
                ("business", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="ai_profile", to="accounts.business")),
            ],
        ),
        migrations.CreateModel(
            name="MemoryFact",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("scope", models.CharField(choices=[("business", "Business"), ("user", "User")], max_length=10)),
                ("text", models.CharField(max_length=300)),
                ("source", models.CharField(default="chat", max_length=20)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("business", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="memory_facts", to="accounts.business")),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="memory_facts", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["id"]},
        ),
    ]
