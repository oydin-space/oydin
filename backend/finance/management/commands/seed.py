from django.core.management.base import BaseCommand

from finance import services as svc
from finance.seed import seed_demo


class Command(BaseCommand):
    help = "Пересоздать демо-бизнес Print Lab Tashkent (с кассовым разрывом в ближайшие недели)"

    def handle(self, *args, **options):
        user = seed_demo()
        pulse = svc.pulse(user.profile.business)
        self.stdout.write(f"Демо готово: {pulse['headline']} (баланс {pulse['balance']}, разрыв {pulse['gap']})")
