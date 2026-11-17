#!/bin/sh
set -e
python manage.py migrate --noinput
# Демо-бизнес создаём один раз: seed пересоздаёт его с нуля, повторный старт не должен сбрасывать данные.
python manage.py shell -c "
from accounts.models import Business
import sys
sys.exit(0 if Business.objects.filter(is_demo=True).exists() else 1)
" || python manage.py seed
exec gunicorn config.wsgi -b 0.0.0.0:8000 -w 4 --worker-class gthread --threads 25 --timeout 90 --access-logfile -
