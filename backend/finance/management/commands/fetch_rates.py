from django.core.management.base import BaseCommand, CommandError

from finance.rates import RateUnavailable, fetch_cbu_rate


class Command(BaseCommand):
    help = "Загружает текущий курс USD с cbu.uz (запускать раз в день)."

    def handle(self, *args, **options):
        try:
            row = fetch_cbu_rate()
        except RateUnavailable as exc:
            raise CommandError(f"cbu.uz недоступен: {exc.detail}") from exc
        self.stdout.write(f"USD {row.rate} на {row.date}")
