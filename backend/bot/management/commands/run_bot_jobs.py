import time

from django.core.management.base import BaseCommand

from bot import jobs

TICK_SECONDS = 300


class Command(BaseCommand):
    help = "Рассылки бота; --loop — каждые 5 минут"

    def add_arguments(self, parser):
        parser.add_argument("--loop", action="store_true")

    def handle(self, *args, loop, **options):
        while True:
            self.stdout.write(f"sent {jobs.run_tick()}")
            if not loop:
                return
            time.sleep(TICK_SECONDS)
