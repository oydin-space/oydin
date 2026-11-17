"""Тексты бота (ru / uz latin / en) и чистые построители сообщений."""

DEFAULT = "ru"
LANGS = ("ru", "uz", "en")

UNIT = {"ru": "сум", "uz": "so'm", "en": "UZS"}

T = {
    "welcome": {
        "ru": "Привет! Я Oydin — помогаю следить за деньгами бизнеса. Пришлите фразу («заплатил 200 тыс за аренду»), SMS из банка или фото чека — я подготовлю запись. Команды: /brief /lang /help",
        "uz": "Salom! Men Oydin — biznes pullarini kuzatishga yordam beraman. Matn («ijara uchun 200 ming to'ladim»), bank SMS yoki chek rasmini yuboring — yozuv tayyorlayman. Buyruqlar: /brief /lang /help",
        "en": "Hi! I'm Oydin — I help you keep an eye on your business money. Send a phrase (\"paid 200k rent\"), a bank SMS or a receipt photo and I'll prepare an entry. Commands: /brief /lang /help",
    },
    "help": {
        "ru": "Пришлите текст, SMS из банка или фото чека — я создам черновик, а вы подтвердите. /brief — сводка на сегодня, /lang — язык.",
        "uz": "Matn, bank SMS yoki chek rasmini yuboring — qoralama yarataman, siz tasdiqlaysiz. /brief — bugungi xulosa, /lang — til.",
        "en": "Send text, a bank SMS or a receipt photo — I'll create a draft and you confirm it. /brief — today's summary, /lang — language.",
    },
    "linked": {
        "ru": "Готово, чат привязан к Oydin.",
        "uz": "Tayyor, chat Oydin bilan bog'landi.",
        "en": "Done, this chat is now linked to Oydin.",
    },
    "need_link": {
        "ru": "Сначала привяжите чат: откройте Oydin → Настройки → Telegram и нажмите «Подключить».",
        "uz": "Avval chatni bog'lang: Oydin → Sozlamalar → Telegram bo'limida «Ulash» tugmasini bosing.",
        "en": "Link this chat first: open Oydin → Settings → Telegram and tap Connect.",
    },
    "bad_code": {
        "ru": "Ссылка устарела или уже использована. Создайте новую в настройках Oydin.",
        "uz": "Havola eskirgan yoki ishlatilgan. Oydin sozlamalarida yangisini yarating.",
        "en": "This link has expired or was already used. Create a new one in Oydin settings.",
    },
    "no_business": {
        "ru": "Сначала создайте бизнес в приложении Oydin.",
        "uz": "Avval Oydin ilovasida biznes yarating.",
        "en": "Create a business in the Oydin app first.",
    },
    "need_consent": {
        "ru": "Чтобы я разбирал сообщения, включите согласие на ИИ: Oydin → Настройки → Согласия → «Использовать ИИ».",
        "uz": "Xabarlarni tahlil qilishim uchun AI roziligini yoqing: Oydin → Sozlamalar → Rozilik → «AI'dan foydalanish».",
        "en": "To let me parse messages, enable AI consent: Oydin → Settings → Consents → Use AI.",
    },
    "no_finance": {
        "ru": "Эта сводка недоступна для вашей роли.",
        "uz": "Bu xulosa sizning rolingiz uchun mavjud emas.",
        "en": "This summary isn't available for your role.",
    },
    "unparsed": {
        "ru": "Не получилось найти сумму и направление. Напишите, например: «заплатил 200 тыс за аренду».",
        "uz": "Summa va yo'nalishni topa olmadim. Masalan: «ijara uchun 200 ming to'ladim».",
        "en": "I couldn't find an amount and direction. Try: \"paid 200k for rent\".",
    },
    "ai_down": {
        "ru": "ИИ сейчас недоступен, попробуйте чуть позже.",
        "uz": "AI hozir mavjud emas, birozdan so'ng urinib ko'ring.",
        "en": "AI is unavailable right now, please try again shortly.",
    },
    "photo_fail": {
        "ru": "Не удалось скачать фото. Попробуйте ещё раз.",
        "uz": "Rasmni yuklab bo'lmadi. Qayta urinib ko'ring.",
        "en": "Couldn't download the photo. Please try again.",
    },
    "confirm_bind": {
        "ru": "Привязать этот чат к аккаунту {who} (бизнес «{business}»)?",
        "uz": "Bu chatni {who} hisobiga (biznes «{business}») bog'laymizmi?",
        "en": "Link this chat to account {who} (business \"{business}\")?",
    },
    "btn_bind": {"ru": "✅ Привязать", "uz": "✅ Bog'lash", "en": "✅ Link"},
    "linked_other": {
        "ru": "Этот чат уже привязан к другому аккаунту. Отправьте /unlink и повторите.",
        "uz": "Bu chat boshqa hisobga bog'langan. /unlink yuboring va qayta urinib ko'ring.",
        "en": "This chat is already linked to another account. Send /unlink first, then try again.",
    },
    "unlinked": {"ru": "Чат отвязан.", "uz": "Chat uzildi.", "en": "Chat unlinked."},
    "no_ai_role": {
        "ru": "ИИ-разбор недоступен для вашей роли.",
        "uz": "AI tahlili sizning rolingiz uchun mavjud emas.",
        "en": "AI parsing isn't available for your role.",
    },
    "throttled": {
        "ru": "Слишком много запросов, подождите минуту.",
        "uz": "Juda ko'p so'rov, bir daqiqa kuting.",
        "en": "Too many requests, please wait a minute.",
    },
    "too_big": {
        "ru": "Файл больше 5 МБ — пришлите поменьше.",
        "uz": "Fayl 5 MB dan katta — kichikroq yuboring.",
        "en": "The file is over 5 MB — please send a smaller one.",
    },
    "confirmed": {"ru": "Записано.", "uz": "Yozildi.", "en": "Saved."},
    "cancelled": {"ru": "Черновик удалён.", "uz": "Qoralama o'chirildi.", "en": "Draft deleted."},
    "gone": {
        "ru": "Этот черновик уже обработан.", "uz": "Bu qoralama allaqachon ko'rib chiqilgan.",
        "en": "This draft was already handled.",
    },
    "choose_lang": {"ru": "Выберите язык:", "uz": "Tilni tanlang:", "en": "Choose a language:"},
    "lang_set": {"ru": "Язык: русский.", "uz": "Til: o'zbekcha.", "en": "Language: English."},
    "btn_ok": {"ru": "✅ Подтвердить", "uz": "✅ Tasdiqlash", "en": "✅ Confirm"},
    "btn_no": {"ru": "✖ Отмена", "uz": "✖ Bekor qilish", "en": "✖ Cancel"},
    "draft": {"ru": "Черновик", "uz": "Qoralama", "en": "Draft"},
    "in": {"ru": "Приход", "uz": "Kirim", "en": "Income"},
    "out": {"ru": "Расход", "uz": "Chiqim", "en": "Expense"},
    "account": {"ru": "Счёт", "uz": "Hisob", "en": "Account"},
    "category": {"ru": "Категория", "uz": "Toifa", "en": "Category"},
    "brief_title": {"ru": "Сводка на сегодня", "uz": "Bugungi xulosa", "en": "Today's brief"},
    "balance": {"ru": "Остаток", "uz": "Qoldiq", "en": "Balance"},
    "safe": {"ru": "Можно тратить", "uz": "Sarflash mumkin", "en": "Safe to spend"},
    "due_today": {"ru": "Платежи сегодня", "uz": "Bugungi to'lovlar", "en": "Due today"},
    "no_due": {"ru": "Платежей сегодня нет.", "uz": "Bugun to'lovlar yo'q.", "en": "Nothing due today."},
    "gap_line": {
        "ru": "Ближайший разрыв: {date}, не хватит {amount}.",
        "uz": "Eng yaqin tanqislik: {date}, {amount} yetmaydi.",
        "en": "Nearest gap: {date}, short by {amount}.",
    },
    "no_gap": {"ru": "Кассовых разрывов не видно.", "uz": "Kassa tanqisligi ko'rinmayapti.", "en": "No cash gaps in sight."},
    "gap_alert": {
        "ru": "⚠️ Прогноз: {date} в кассе не хватит {amount}. Загляните в Oydin, чтобы решить, что перенести.",
        "uz": "⚠️ Prognoz: {date} kassada {amount} yetmaydi. Nimani ko'chirishni hal qilish uchun Oydin'ga kiring.",
        "en": "⚠️ Forecast: on {date} you'll be short by {amount}. Open Oydin to decide what to move.",
    },
    "weekly_title": {"ru": "Итоги недели", "uz": "Hafta yakuni", "en": "Weekly digest"},
    "income": {"ru": "Поступления", "uz": "Tushumlar", "en": "Income"},
    "expense": {"ru": "Расходы", "uz": "Xarajatlar", "en": "Expenses"},
    "top_cats": {"ru": "Основные расходы", "uz": "Asosiy xarajatlar", "en": "Top expenses"},
    "insight": {
        "ru": "Главная статья расходов — «{label}»: {pct}% всех трат.",
        "uz": "Asosiy xarajat — «{label}»: barcha xarajatlarning {pct}%.",
        "en": "Biggest cost is \"{label}\": {pct}% of spending.",
    },
    "tax_soon": {
        "ru": "🧾 Через {days} дн.: {title} ({date}){amount}.",
        "uz": "🧾 {days} kundan so'ng: {title} ({date}){amount}.",
        "en": "🧾 In {days} days: {title} ({date}){amount}.",
    },
    "tax_today": {
        "ru": "🧾 Сегодня срок: {title}{amount}.",
        "uz": "🧾 Bugun muddat: {title}{amount}.",
        "en": "🧾 Due today: {title}{amount}.",
    },
}


def norm(lang):
    return lang if lang in LANGS else DEFAULT


def tr(key, lang, **kw):
    text = T[key][norm(lang)]
    return text.format(**kw) if kw else text


def money(amount, lang):
    sign = "−" if amount < 0 else ""
    return f"{sign}{abs(int(amount)):,}".replace(",", " ") + " " + UNIT[norm(lang)]


def day(d):
    return f"{d.day:02d}.{d.month:02d}"


def build_brief(lang, balance, safe, due, gap):
    """due: [(title, amount)]; gap: (date, amount) | None."""
    lines = [f"☀️ {tr('brief_title', lang)}", f"{tr('balance', lang)}: {money(balance, lang)}",
             f"{tr('safe', lang)}: {money(safe, lang)}"]
    if due:
        lines.append(f"{tr('due_today', lang)}:")
        lines += [f"• {title} — {money(amount, lang)}" for title, amount in due]
    else:
        lines.append(tr("no_due", lang))
    lines.append(tr("gap_line", lang, date=day(gap[0]), amount=money(gap[1], lang)) if gap else tr("no_gap", lang))
    return "\n".join(lines)


def build_gap_alert(lang, gap_date, amount):
    return tr("gap_alert", lang, date=day(gap_date), amount=money(amount, lang))


def build_weekly(lang, revenue, expenses, top):
    """top: [(label, value)] по убыванию."""
    lines = [f"📊 {tr('weekly_title', lang)}", f"{tr('income', lang)}: {money(revenue, lang)}",
             f"{tr('expense', lang)}: {money(expenses, lang)}"]
    if top:
        lines.append(f"{tr('top_cats', lang)}:")
        lines += [f"• {label} — {money(value, lang)}" for label, value in top[:3]]
        total = sum(v for _, v in top)
        if total > 0:
            lines.append(tr("insight", lang, label=top[0][0], pct=round(top[0][1] * 100 / total)))
    return "\n".join(lines)


def build_tax(lang, title, due_date, amount, days):
    extra = f" — {money(amount, lang)}" if amount else ""
    if days == 0:
        return tr("tax_today", lang, title=title, amount=extra)
    return tr("tax_soon", lang, days=days, title=title, date=day(due_date), amount=extra)


def build_draft(lang, draft, account_name):
    return "\n".join([
        f"📝 {tr('draft', lang)}",
        f"{tr(draft['direction'], lang)}: {money(draft['amount'], lang)}",
        f"{tr('category', lang)}: {draft['category']}",
        f"{tr('account', lang)}: {account_name}",
    ])
