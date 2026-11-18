"""Профиль бота в Telegram (имя, описания, команды, кнопка меню, аватар). Идемпотентно: сначала get*, set* только при отличии."""

from pathlib import Path

from django.core.management.base import BaseCommand, CommandError

from bot import client

ASSETS = Path(__file__).resolve().parents[2] / "assets"
APP_URL = "https://oydin.sayfi.uz/app"
# "" — язык по умолчанию (для пользователей вне ru/uz/en), берём русский.
LANGS = ("", "ru", "uz", "en")

NAME = "Oydin"
DESCRIPTION = {
    "ru": "Oydin — второй мозг вашего малого бизнеса. Пришлите фразу, SMS из банка или фото чека — я подготовлю запись о доходе или расходе, а вы подтвердите. Сводка дня, долги, курс — в одном чате.",
    "uz": "Oydin — kichik biznesingizning ikkinchi miyasi. Matn, bank SMS yoki chek rasmini yuboring — daromad yoki xarajat yozuvini tayyorlayman, siz tasdiqlaysiz. Kun xulosasi, qarzlar, kurs — bitta chatda.",
    "en": "Oydin is the second brain for your small business. Send a phrase, a bank SMS or a receipt photo and I'll prepare an income or expense entry for you to confirm. Daily brief, debts and rates in one chat.",
}
SHORT = {
    "ru": "Второй мозг малого бизнеса: учёт денег из чата",
    "uz": "Kichik biznesning ikkinchi miyasi: pul hisobi chatdan",
    "en": "Second brain for small business: money tracking in chat",
}
COMMANDS = {
    "ru": [
        ("start", "Начать и привязать чат"),
        ("brief", "Сводка на сегодня"),
        ("lang", "Выбрать язык"),
        ("help", "Что умеет бот"),
        ("unlink", "Отвязать чат"),
    ],
    "uz": [
        ("start", "Boshlash va chatni bogʻlash"),
        ("brief", "Bugungi xulosa"),
        ("lang", "Tilni tanlash"),
        ("help", "Bot nimalarni qila oladi"),
        ("unlink", "Chatni uzish"),
    ],
    "en": [
        ("start", "Start and link this chat"),
        ("brief", "Today's summary"),
        ("lang", "Choose language"),
        ("help", "What the bot can do"),
        ("unlink", "Unlink this chat"),
    ],
}
MENU_TEXT = {"ru": "Открыть Oydin", "uz": "Oydinni ochish", "en": "Open Oydin"}


def _src(lang):
    return lang or "ru"


def _payload(lang, **fields):
    return {**fields, "language_code": lang} if lang else fields


def _lget(lang):
    return {"language_code": lang} if lang else {}


def plan_items():
    """[(метка, get-метод, get-payload, извлечение текущего, желаемое, set-метод, set-payload)]."""
    items = []
    for lang in LANGS:
        s = _src(lang)
        tag = lang or "default"
        cmds = [{"command": c, "description": d} for c, d in COMMANDS[s]]
        items += [
            (f"name[{tag}]", "getMyName", _lget(lang), lambda r: r.get("name", ""), NAME,
             "setMyName", _payload(lang, name=NAME)),
            (f"description[{tag}]", "getMyDescription", _lget(lang), lambda r: r.get("description", ""), DESCRIPTION[s],
             "setMyDescription", _payload(lang, description=DESCRIPTION[s])),
            (f"short_description[{tag}]", "getMyShortDescription", _lget(lang), lambda r: r.get("short_description", ""),
             SHORT[s], "setMyShortDescription", _payload(lang, short_description=SHORT[s])),
            (f"commands[{tag}]", "getMyCommands", _lget(lang), lambda r: [dict(c) for c in r], cmds,
             "setMyCommands", _payload(lang, commands=cmds)),
        ]
    return items


def menu_button():
    return {"type": "web_app", "text": MENU_TEXT["ru"], "web_app": {"url": APP_URL}}


def menu_matches(current):
    return (
        current.get("type") == "web_app"
        and current.get("text") == MENU_TEXT["ru"]
        and (current.get("web_app") or {}).get("url") == APP_URL
    )


class Command(BaseCommand):
    help = "Приводит профиль бота в Telegram к эталону; --dry-run только печатает отличия."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="не менять, только показать отличия")
        parser.add_argument("--force-photo", action="store_true", help="загрузить аватар, даже если он уже есть")

    def handle(self, *args, dry_run=False, force_photo=False, **options):
        self.dry = dry_run
        self.changed = 0
        try:
            for label, getter, gpayload, extract, wanted, setter, spayload in plan_items():
                current = extract(client.call(getter, gpayload))
                self.apply(label, current, wanted, setter, spayload)
            self.menu()
            self.photo(force_photo)
        except client.BotError as exc:
            raise CommandError(f"Telegram: {exc}") from None
        self.stdout.write(f"{'Отличий' if dry_run else 'Обновлено'}: {self.changed}")

    def apply(self, label, current, wanted, method, payload):
        if current == wanted:
            self.stdout.write(f"= {label}")
            return
        self.changed += 1
        self.stdout.write(f"~ {label}: {current!r} -> {wanted!r}")
        if not self.dry:
            client.call(method, payload)

    def menu(self):
        current = client.call("getChatMenuButton", {})
        if menu_matches(current):
            self.stdout.write("= menu_button")
            return
        self.changed += 1
        self.stdout.write(f"~ menu_button: {current!r} -> web_app {APP_URL}")
        if not self.dry:
            client.call("setChatMenuButton", {"menu_button": menu_button()})

    def photo(self, force):
        # Аватар бота нельзя прочитать байтами: считаем «задан», если у бота есть хотя бы одно фото профиля.
        try:
            me = client.call("getMe")
            total = client.call("getUserProfilePhotos", {"user_id": me["id"], "limit": 1})["total_count"]
        except (client.BotError, KeyError):
            if not force:
                self.stdout.write("? profile_photo: не удалось проверить, пропуск (--force-photo чтобы загрузить)")
                return
            total = 0
        if total and not force:
            self.stdout.write("= profile_photo")
            return
        self.changed += 1
        self.stdout.write(f"~ profile_photo: {'есть' if total else 'нет'} -> {ASSETS / 'profile.png'}")
        if not self.dry:
            client.upload_profile_photo((ASSETS / "profile.png").read_bytes())
