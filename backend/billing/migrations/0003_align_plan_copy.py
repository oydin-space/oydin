from django.db import migrations

# Pricing copy aligned with what the product actually gates: nothing is plan-gated yet, the forecast
# and the public API work on every plan, and bank/service integrations are still "soon".
CHANGES = {
    "free": {
        "tagline": {"ru": "Пульс бизнеса и прогноз кассовых разрывов в одном месте", "uz": "Biznes pulsi va kassa uzilishlari prognozi bir joyda", "en": "Your business pulse and cash-gap forecast in one place"},
        "features": {
            "ru": ["Учёт доходов и расходов", "Пульс: остаток, долги, ближайшие платежи", "Прогноз кассовых разрывов", "Голосовой и текстовый ввод", "Импорт выписок и Excel", "Публичный API для владельца"],
            "uz": ["Daromad va xarajatlar hisobi", "Puls: qoldiq, qarzlar, yaqin toʻlovlar", "Kassa uzilishlari prognozi", "Ovozli va matnli kiritish", "Koʻchirma va Excel import", "Egasi uchun ochiq API"],
            "en": ["Income and expense tracking", "Pulse: balance, debts, upcoming payments", "Cash-gap forecast", "Voice and text entry", "Statement and Excel import", "Public API for the owner"],
        },
        "missing": {
            "ru": ["Интеграции с банками и сервисами (скоро)", "Команда: бухгалтер и продавцы", "ИИ-помощник без ограничений"],
            "uz": ["Bank va servislar bilan integratsiya (tez orada)", "Jamoa: buxgalter va sotuvchilar", "Cheklovsiz AI yordamchi"],
            "en": ["Bank and service integrations (soon)", "Team: accountant and sellers", "Unlimited AI assistant"],
        },
    },
    "pro": {
        "tagline": {"ru": "ИИ без лимитов и планирование для растущего бизнеса", "uz": "Oʻsayotgan biznes uchun cheklovsiz AI va rejalashtirish", "en": "Unlimited AI and planning for a growing business"},
        "new_features": {
            "ru": ["Интеграции с банками и сервисами (скоро)", "Свои инструменты от ИИ"],
            "uz": ["Bank va servislar bilan integratsiya (tez orada)", "AI yaratgan shaxsiy vositalar"],
            "en": ["Bank and service integrations (soon)", "Custom AI-built tools"],
        },
    },
    "team": {
        "new_features": {
            "ru": ["Команда без ограничений", "Бот для продавцов"],
            "uz": ["Cheklovsiz jamoa", "Sotuvchilar uchun bot"],
            "en": ["Unlimited team members", "Bot for sellers"],
        },
    },
}


def apply(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for code, fields in CHANGES.items():
        Plan.objects.filter(code=code).update(**fields)


class Migration(migrations.Migration):
    dependencies = [("billing", "0002_seed_plans")]
    operations = [migrations.RunPython(apply, migrations.RunPython.noop)]
