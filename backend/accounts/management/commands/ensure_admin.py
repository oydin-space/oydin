from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Создаёт суперпользователя из ADMIN_EMAIL/ADMIN_PASSWORD (идемпотентно; без них ничего не делает)."

    def handle(self, *args, **options):
        email = settings.ADMIN_EMAIL.strip().lower()
        password = settings.ADMIN_PASSWORD
        if not email or not password:
            self.stdout.write("ensure_admin: ADMIN_EMAIL/ADMIN_PASSWORD не заданы, пропускаю")
            return
        User = get_user_model()
        user = User.objects.filter(username=email).first() or User.objects.filter(email__iexact=email).order_by("id").first()
        if user is None:
            # Пароль задаём только при создании: смену пароля в админке перезапуск не откатывает.
            User.objects.create_superuser(username=email, email=email, password=password)
            self.stdout.write(f"ensure_admin: создан {email}")
            return
        # Существующих пользователей не повышаем: иначе вход по почте/Google дал бы доступ в админку.
        self.stdout.write(f"ensure_admin: {email} уже есть, не меняю")
