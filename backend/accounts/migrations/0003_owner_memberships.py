from django.db import migrations


def create_owner_memberships(apps, schema_editor):
    """До мультиарендности бизнес принадлежал владельцу профиля — делаем его владельцем явно."""
    Profile = apps.get_model("accounts", "Profile")
    Membership = apps.get_model("accounts", "Membership")
    for profile in Profile.objects.exclude(business=None).iterator():
        Membership.objects.get_or_create(
            user_id=profile.user_id, business_id=profile.business_id, defaults={"role": "owner"}
        )


class Migration(migrations.Migration):
    dependencies = [
        ("accounts", "0002_emailcode_alter_business_options_profile_google_sub_and_more"),
    ]

    operations = [
        migrations.RunPython(create_owner_memberships, migrations.RunPython.noop),
    ]
