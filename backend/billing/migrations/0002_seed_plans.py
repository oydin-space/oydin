from django.db import migrations

PLANS = [
    {
        "code": "free", "order": 1, "is_popular": False, "icon": "sprout", "price_uzs": 0,
        "name": {"ru": "Бесплатный", "uz": "Bepul", "en": "Free"},
        "tagline": {"ru": "Пульс бизнеса: деньги, долги и обязательства в одном месте", "uz": "Biznes pulsi: pul, qarz va majburiyatlar bir joyda", "en": "Your business pulse: money, debts and obligations in one place"},
        "cta_note": {"ru": "Без карты, навсегда", "uz": "Kartasiz, doimiy", "en": "No card, forever"},
        "features": {
            "ru": ["Учёт доходов и расходов", "Пульс: остаток, долги, ближайшие платежи", "Голосовой и текстовый ввод", "Импорт выписок и Excel"],
            "uz": ["Daromad va xarajatlar hisobi", "Puls: qoldiq, qarzlar, yaqin toʻlovlar", "Ovozli va matnli kiritish", "Koʻchirma va Excel import"],
            "en": ["Income and expense tracking", "Pulse: balance, debts, upcoming payments", "Voice and text entry", "Statement and Excel import"],
        },
        "new_features": {"ru": [], "uz": [], "en": []},
        "missing": {
            "ru": ["Прогноз кассовых разрывов", "Интеграции с банками и сервисами", "Команда: бухгалтер и продавцы", "ИИ-помощник без ограничений"],
            "uz": ["Kassa uzilishlari prognozi", "Bank va servislar bilan integratsiya", "Jamoa: buxgalter va sotuvchilar", "Cheklovsiz AI yordamchi"],
            "en": ["Cash-gap forecast", "Bank and service integrations", "Team: accountant and sellers", "Unlimited AI assistant"],
        },
        "limits": {
            "ru": ["1 бизнес", "30 вопросов ИИ в месяц", "Только владелец"],
            "uz": ["1 ta biznes", "Oyiga 30 ta AI savol", "Faqat egasi"],
            "en": ["1 business", "30 AI questions per month", "Owner only"],
        },
    },
    {
        "code": "pro", "order": 2, "is_popular": True, "icon": "rocket", "price_uzs": 149000,
        "name": {"ru": "Про", "uz": "Pro", "en": "Pro"},
        "tagline": {"ru": "Прогноз и ИИ, чтобы видеть кассовые разрывы заранее", "uz": "Kassa uzilishlarini oldindan koʻrish uchun prognoz va AI", "en": "Forecast and AI to see cash gaps ahead of time"},
        "cta_note": {"ru": "Оплата через Click, отмена в любой момент", "uz": "Click orqali toʻlov, istalgan payt bekor qilish", "en": "Pay with Click, cancel anytime"},
        "features": {
            "ru": ["Всё из бесплатного тарифа", "Безлимитные вопросы ИИ", "Планирование и сезонность", "Напоминания должникам"],
            "uz": ["Bepul tarifdagi hamma narsa", "Cheklovsiz AI savollar", "Rejalashtirish va mavsumiylik", "Qarzdorlarga eslatmalar"],
            "en": ["Everything in Free", "Unlimited AI questions", "Planning and seasonality", "Debtor reminders"],
        },
        "new_features": {
            "ru": ["Прогноз кассовых разрывов", "Интеграции с банками и сервисами", "Свои инструменты от ИИ"],
            "uz": ["Kassa uzilishlari prognozi", "Bank va servislar bilan integratsiya", "AI yaratgan shaxsiy vositalar"],
            "en": ["Cash-gap forecast", "Bank and service integrations", "Custom AI-built tools"],
        },
        "missing": {"ru": [], "uz": [], "en": []},
        "limits": {"ru": ["До 3 бизнесов"], "uz": ["3 tagacha biznes"], "en": ["Up to 3 businesses"]},
    },
    {
        "code": "team", "order": 3, "is_popular": False, "icon": "users", "price_uzs": 249000,
        "name": {"ru": "Команда", "uz": "Jamoa", "en": "Team"},
        "tagline": {"ru": "Для бизнеса с бухгалтером и продавцами", "uz": "Buxgalter va sotuvchilari bor biznes uchun", "en": "For businesses with an accountant and sellers"},
        "cta_note": {"ru": "Оплата через Click, отмена в любой момент", "uz": "Click orqali toʻlov, istalgan payt bekor qilish", "en": "Pay with Click, cancel anytime"},
        "features": {
            "ru": ["Всё из тарифа Про", "Роли: владелец, бухгалтер, продавец", "Общий доступ и приглашения", "Приоритетная поддержка"],
            "uz": ["Pro tarifidagi hamma narsa", "Rollar: ega, buxgalter, sotuvchi", "Umumiy kirish va takliflar", "Ustuvor yordam"],
            "en": ["Everything in Pro", "Roles: owner, accountant, seller", "Shared access and invites", "Priority support"],
        },
        "new_features": {
            "ru": ["Команда без ограничений", "Бот для продавцов", "Публичный API"],
            "uz": ["Cheklovsiz jamoa", "Sotuvchilar uchun bot", "Ochiq API"],
            "en": ["Unlimited team members", "Bot for sellers", "Public API"],
        },
        "missing": {"ru": [], "uz": [], "en": []},
        "limits": {"ru": ["До 10 бизнесов"], "uz": ["10 tagacha biznes"], "en": ["Up to 10 businesses"]},
    },
]


def seed(apps, schema_editor):
    Plan = apps.get_model("billing", "Plan")
    for data in PLANS:
        Plan.objects.update_or_create(code=data["code"], defaults={**data, "image": f"/pricing/{data['code']}.webp", "period": "month"})


class Migration(migrations.Migration):
    dependencies = [("billing", "0001_initial")]
    operations = [migrations.RunPython(seed, migrations.RunPython.noop)]
