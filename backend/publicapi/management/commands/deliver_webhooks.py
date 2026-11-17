import time

from django.core.management.base import BaseCommand

from publicapi.services import deliver_due


class Command(BaseCommand):
    help = "Отправляет вебхуки из очереди (WebhookDelivery), у которых наступило время попытки."

    def add_arguments(self, parser):
        parser.add_argument("--loop", action="store_true", help="работать постоянно")
        parser.add_argument("--interval", type=int, default=15, help="пауза между проходами, с")

    def handle(self, *args, **options):
        while True:
            done = deliver_due()
            self.stdout.write(f"processed {len(done)}")
            if not options["loop"]:
                return
            time.sleep(options["interval"])
