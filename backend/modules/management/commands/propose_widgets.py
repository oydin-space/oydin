from django.core.management.base import BaseCommand

from accounts.models import Business
from modules.services import propose_from_usage


class Command(BaseCommand):
    help = "Предложения по виджетам из журнала использования (эвристики; --llm добавляет модель)."

    def add_arguments(self, parser):
        parser.add_argument("--business", type=int, help="id бизнеса; по умолчанию все")
        parser.add_argument("--llm", action="store_true")

    def handle(self, *args, business=None, llm=False, **opts):
        qs = Business.objects.filter(pk=business) if business else Business.objects.filter(is_demo=False)
        total = sum(len(propose_from_usage(b, use_llm=llm)) for b in qs)
        self.stdout.write(f"Создано предложений: {total}")
