from datetime import date, datetime, timedelta
from unittest import mock
from zoneinfo import ZoneInfo

from django.contrib.auth import get_user_model
from django.test import Client, TestCase, override_settings
from django.utils import timezone

from accounts.consent import set_consent
from accounts.models import Membership, Profile
from accounts.services import create_business
from ai import llm
from finance.models import Account, Obligation, Transaction
from planning.models import TaxReminder

from . import conf, jobs, services, texts
from .models import LinkCode, NotificationSettings, SentNotification, TelegramLink

User = get_user_model()
TZ = ZoneInfo("Asia/Tashkent")
URLS = override_settings(ROOT_URLCONF="bot.tests_urls", TELEGRAM_BOT_TOKEN="123:abc")


def msg(chat_id, text=None, **extra):
    return {"update_id": 1, "message": {"chat": {"id": chat_id, "type": "private"}, "from": {"id": chat_id, "language_code": "ru"},
                                        **({"text": text} if text else {}), **extra}}


class Base(TestCase):
    def setUp(self):
        self.user = User.objects.create(username="owner")
        self.business = create_business(self.user, "Лавка")
        self.link = TelegramLink.objects.create(user=self.user, chat_id=500, lang="ru")
        self.patch = mock.patch("bot.client.call")
        self.call = self.patch.start()
        self.addCleanup(self.patch.stop)

    def sent(self):
        return [c.args[1] for c in self.call.call_args_list if c.args[0] == "sendMessage"]

    def last_text(self):
        return self.sent()[-1]["text"]


@URLS
class WebhookTests(Base):
    def post(self, secret, body=None):
        headers = {"HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN": secret} if secret is not None else {}
        return Client(enforce_csrf_checks=True).post("/api/telegram/webhook/", body or msg(500, "/help"),
                                                     content_type="application/json", **headers)

    def test_secret_required(self):
        self.assertEqual(self.post(None).status_code, 403)
        self.assertEqual(self.post("wrong").status_code, 403)
        self.assertEqual(self.sent(), [])

    def test_valid_secret(self):
        self.assertEqual(self.post(conf.webhook_secret()).status_code, 200)
        self.assertIn("Пришлите", self.last_text())

    @override_settings(TELEGRAM_BOT_TOKEN="")
    def test_no_token_rejects(self):
        self.assertEqual(self.post("").status_code, 403)

    def test_command_registers_webhook(self):
        from django.core.management import call_command

        call_command("set_telegram_webhook", "https://x.uz/")
        method, payload = self.call.call_args.args
        self.assertEqual(method, "setWebhook")
        self.assertEqual(payload["url"], "https://x.uz/api/telegram/webhook/")
        self.assertEqual(payload["secret_token"], conf.webhook_secret())


@URLS
class LinkTests(Base):
    def setUp(self):
        super().setUp()
        TelegramLink.objects.all().delete()
        self.client.force_login(self.user)

    def start(self):
        res = self.client.post("/api/telegram/link/")
        self.assertEqual(res.status_code, 200)
        url = res.json()["url"]
        self.assertTrue(url.startswith("https://t.me/oydin_agent?start="))
        return url.split("start=")[1]

    def test_flow(self):
        self.assertEqual(self.client.get("/api/telegram/link/").json(), {"linked": False})
        code = self.start()
        self.assertFalse(LinkCode.objects.filter(code_hash=code).exists())  # хранится хеш
        services.handle_update(msg(777, f"/start {code}"))
        self.assertEqual(TelegramLink.objects.get(user=self.user).chat_id, 777)
        self.assertTrue(self.client.get("/api/telegram/link/").json()["linked"])
        services.handle_update(msg(778, f"/start {code}"))  # одноразовый
        self.assertEqual(TelegramLink.objects.get(user=self.user).chat_id, 777)
        self.assertIn("устарела", self.last_text())
        self.assertFalse(self.client.delete("/api/telegram/link/").json()["linked"])
        self.assertFalse(TelegramLink.objects.exists())

    def test_expiry(self):
        code = self.start()
        LinkCode.objects.update(expires_at=timezone.now() - timedelta(seconds=1))
        services.handle_update(msg(777, f"/start {code}"))
        self.assertFalse(TelegramLink.objects.exists())

    def test_requires_login(self):
        self.assertEqual(Client().post("/api/telegram/link/").status_code, 401)

    def test_auto_link_for_telegram_login(self):
        Profile.objects.filter(user=self.user).update(telegram_id=900)
        update = msg(900, "/start")
        update["message"]["chat"]["id"] = 901
        services.handle_update(update)
        self.assertEqual(TelegramLink.objects.get(user=self.user).chat_id, 901)

    def test_start_without_match_asks_to_link(self):
        services.handle_update(msg(1234, "/start"))
        self.assertIn("Сначала привяжите", self.last_text())


@URLS
class SettingsTests(Base):
    def test_defaults_and_update(self):
        self.client.force_login(self.user)
        body = self.client.get("/api/notifications/settings/").json()
        self.assertEqual(body, {"daily_brief": True, "gap_alerts": True, "weekly_digest": True, "tax_reminders": True,
                                "brief_hour": 9, "timezone": "Asia/Tashkent"})
        res = self.client.put("/api/notifications/settings/", {"daily_brief": False, "brief_hour": 7}, content_type="application/json")
        self.assertEqual((res.json()["daily_brief"], res.json()["brief_hour"]), (False, 7))
        self.assertEqual(self.client.get("/api/notifications/settings/").json()["brief_hour"], 7)
        bad = self.client.put("/api/notifications/settings/", {"brief_hour": 25}, content_type="application/json")
        self.assertEqual(bad.status_code, 400)


class TextTests(TestCase):
    def test_brief_three_languages(self):
        args = (2_480_000, 900_000, [("Аренда", 1_000_000)], (date(2026, 11, 25), 300_000))
        ru, uz, en = (texts.build_brief(lang, *args) for lang in ("ru", "uz", "en"))
        self.assertIn("Сводка на сегодня", ru)
        self.assertIn("2 480 000 сум", ru)
        self.assertIn("Bugungi xulosa", uz)
        self.assertIn("2 480 000 so'm", uz)
        self.assertIn("Today's brief", en)
        self.assertIn("short by 300 000 UZS", en)
        self.assertIn("25.11", en)

    def test_brief_without_due_or_gap(self):
        text = texts.build_brief("en", 10, 5, [], None)
        self.assertIn("Nothing due today.", text)
        self.assertIn("No cash gaps", text)

    def test_weekly(self):
        text = texts.build_weekly("en", 5_000_000, 3_000_000, [("Аренда", 2_000_000), ("Налоги", 1_000_000)])
        self.assertIn("Weekly digest", text)
        self.assertIn("67%", text)

    def test_unknown_lang_falls_back(self):
        self.assertEqual(texts.tr("help", "de"), texts.T["help"]["ru"])


class JobBase(Base):
    def prefs(self, **flags):
        values = {"daily_brief": False, "gap_alerts": False, "weekly_digest": False, "tax_reminders": False, **flags}
        NotificationSettings.objects.create(user=self.user, business=self.business, **values)


class JobTests(JobBase):
    def test_brief_sent_once_per_day(self):
        self.prefs(daily_brief=True)
        now = timezone.now().astimezone(TZ).replace(hour=12)
        self.assertEqual(jobs.run_tick(now), 1)
        self.assertEqual(jobs.run_tick(now), 0)
        self.assertIn("Сводка на сегодня", self.last_text())
        NotificationSettings.objects.update(brief_hour=23)
        SentNotification.objects.all().delete()
        self.assertEqual(jobs.run_tick(now), 0)  # час ещё не наступил

    def test_gap_alert_dedupe(self):
        self.prefs(gap_alerts=True)
        Account.objects.filter(business=self.business).update(opening_balance=1_000_000)
        Obligation.objects.create(business=self.business, title="Аренда", kind="rent", amount=5_000_000,
                                  due_date=timezone.localdate() + timedelta(days=5))
        now = timezone.now().astimezone(TZ)
        self.assertEqual(jobs.run_tick(now), 1)
        self.assertIn("не хватит", self.last_text())
        self.assertEqual(jobs.run_tick(now + timedelta(hours=5)), 0)
        self.assertEqual(jobs.run_tick(now + timedelta(days=2)), 0)
        self.assertEqual(jobs.run_tick(now + timedelta(days=3, minutes=1)), 1)

    def test_no_gap_alert_beyond_14_days(self):
        self.prefs(gap_alerts=True)
        Obligation.objects.create(business=self.business, title="Аренда", kind="rent", amount=5_000_000,
                                  due_date=timezone.localdate() + timedelta(days=20))
        self.assertEqual(jobs.run_tick(), 0)

    def test_tax_reminder_timing(self):
        self.prefs(tax_reminders=True)
        due = date(2026, 12, 20)
        TaxReminder.objects.create(business=self.business, title="НДС", kind="payment", due_date=due, amount=1_200_000,
                                   confirmed_at=timezone.now())

        def at(day):
            return datetime(day.year, day.month, day.day, 10, tzinfo=TZ)

        self.assertEqual(jobs.run_tick(at(due - timedelta(days=4))), 0)
        self.assertEqual(jobs.run_tick(at(due - timedelta(days=3))), 1)
        self.assertIn("Через 3 дн.", self.last_text())
        self.assertEqual(jobs.run_tick(at(due - timedelta(days=3))), 0)
        self.assertEqual(jobs.run_tick(at(due - timedelta(days=1))), 0)
        self.assertEqual(jobs.run_tick(at(due)), 1)
        self.assertIn("Сегодня срок", self.last_text())

    def test_weekly_digest_on_monday(self):
        self.prefs(weekly_digest=True)
        monday = datetime(2026, 11, 16, 10, tzinfo=TZ)
        self.assertEqual(jobs.run_tick(monday + timedelta(days=1)), 0)
        self.assertEqual(jobs.run_tick(monday), 1)
        self.assertEqual(jobs.run_tick(monday), 0)
        self.assertIn("Итоги недели", self.last_text())

    def test_seller_gets_nothing(self):
        seller = User.objects.create(username="seller")
        Membership.objects.create(user=seller, business=self.business, role="seller")
        Profile.objects.update_or_create(user=seller, defaults={"business": self.business})
        TelegramLink.objects.create(user=seller, chat_id=600)
        TelegramLink.objects.filter(user=self.user).delete()
        Obligation.objects.create(business=self.business, title="Аренда", kind="rent", amount=5_000_000,
                                  due_date=timezone.localdate() + timedelta(days=2))
        self.assertEqual(jobs.run_tick(), 0)
        self.assertEqual(self.sent(), [])

    def test_blocked_chat_unlinked(self):
        from bot.client import BotError

        self.prefs(daily_brief=True)
        self.call.side_effect = BotError(403, "blocked")
        self.assertEqual(jobs.run_tick(timezone.now().astimezone(TZ).replace(hour=12)), 0)
        self.assertFalse(TelegramLink.objects.exists())


class MessageTests(Base):
    def setUp(self):
        super().setUp()
        set_consent(self.user, "ai", True)

    def draft_message(self):
        return next(c.args[1] for c in self.call.call_args_list if c.args[0] == "sendMessage" and "reply_markup" in c.args[1])

    def test_text_draft_and_confirm(self):
        services.handle_update(msg(500, "заплатил 200 тыс за аренду"))
        tx = Transaction.objects.get()
        self.assertEqual((tx.status, tx.amount, tx.direction, tx.category, tx.created_by, tx.source),
                         ("draft", 200_000, "out", "Аренда", self.user, "chat"))
        buttons = self.draft_message()["reply_markup"]["inline_keyboard"][0]
        self.assertEqual([b["callback_data"] for b in buttons], [f"ok:{tx.id}", f"no:{tx.id}"])
        self.assertIn("200 000 сум", self.draft_message()["text"])
        services.handle_update({"callback_query": {"id": "q", "from": {"id": 500}, "data": f"ok:{tx.id}",
                                                   "message": {"message_id": 9, "chat": {"id": 500}}}})
        tx.refresh_from_db()
        self.assertEqual(tx.status, "confirmed")
        self.assertIn("Записано", self.last_text())

    def test_cancel_deletes_and_replay_is_noop(self):
        services.handle_update(msg(500, "заплатил 200 тыс за аренду"))
        tx = Transaction.objects.get()
        cb = {"callback_query": {"id": "q", "from": {"id": 500}, "data": f"no:{tx.id}", "message": {"message_id": 9, "chat": {"id": 500}}}}
        services.handle_update(cb)
        self.assertFalse(Transaction.objects.exists())
        services.handle_update(cb)
        self.assertIn("обработан", self.call.call_args.args[1]["text"])

    def test_callback_from_other_chat_cannot_touch_draft(self):
        services.handle_update(msg(500, "заплатил 200 тыс за аренду"))
        tx = Transaction.objects.get()
        other = User.objects.create(username="o2")
        create_business(other, "Чужой")
        TelegramLink.objects.create(user=other, chat_id=501)
        services.handle_update({"callback_query": {"id": "q", "from": {"id": 501}, "data": f"ok:{tx.id}",
                                                   "message": {"message_id": 9, "chat": {"id": 501}}}})
        tx.refresh_from_db()
        self.assertEqual(tx.status, "draft")

    def test_bank_sms_goes_to_llm(self):
        account = Account.objects.filter(business=self.business, kind="card").first()
        raw = {"amount": 1_500_000, "direction": "in", "category": "Продажи", "purpose": "business",
               "account_id": account.id, "counterparty": "Humo", "note": "SMS"}
        with mock.patch("ai.llm.complete", return_value=raw) as complete:
            services.handle_update(msg(500, "HUMOQ *1234 Popolnenie 1500000.00 UZS"))
        tx = Transaction.objects.get()
        self.assertEqual((tx.amount, tx.direction, tx.account_id, tx.status), (1_500_000, "in", account.id, "draft"))
        self.assertEqual(complete.call_count, 1)

    def test_photo_draft(self):
        account = Account.objects.filter(business=self.business).first()
        raw = {"amount": 85_000, "direction": "out", "category": "Закупки", "purpose": "business", "account_id": account.id}
        with mock.patch("bot.client.download_file", return_value=(b"\xff\xd8img", "image/jpeg")), \
                mock.patch("ai.llm.complete", return_value=raw) as complete:
            services.handle_update(msg(500, photo=[{"file_id": "small"}, {"file_id": "big"}]))
        self.assertEqual(Transaction.objects.get().amount, 85_000)
        content = complete.call_args.args[1][0]["content"]
        self.assertEqual(content[1]["type"], "image_url")
        self.assertTrue(content[1]["image_url"]["url"].startswith("data:image/jpeg;base64,"))

    def test_unparsed_and_ai_down(self):
        with mock.patch("ai.llm.complete", return_value={"amount": 0}):
            services.handle_update(msg(500, "привет как дела"))
        self.assertIn("Не получилось", self.last_text())
        self.assertFalse(Transaction.objects.exists())
        with mock.patch("ai.llm.complete", side_effect=llm.AiUnavailable()):
            services.handle_update(msg(500, "привет как дела"))
        self.assertIn("недоступен", self.last_text())

    def test_consent_required(self):
        set_consent(self.user, "ai", False)
        with mock.patch("ai.llm.complete") as complete:
            services.handle_update(msg(500, "заплатил 200 тыс за аренду"))
            services.handle_update(msg(500, photo=[{"file_id": "x"}]))
        self.assertIn("согласие", self.last_text())
        self.assertFalse(Transaction.objects.exists())
        complete.assert_not_called()

    def test_brief_and_lang_commands(self):
        services.handle_update(msg(500, "/lang en"))
        self.assertEqual(TelegramLink.objects.get().lang, "en")
        services.handle_update(msg(500, "/brief"))
        self.assertIn("Today's brief", self.last_text())
        services.handle_update(msg(500, "/lang"))
        self.assertIn("reply_markup", self.sent()[-1])

    def test_unlinked_chat(self):
        services.handle_update(msg(999, "заплатил 200 тыс"))
        self.assertIn("Сначала привяжите", self.last_text())
        self.assertFalse(Transaction.objects.exists())

    def test_group_chats_ignored(self):
        update = msg(500, "/brief")
        update["message"]["chat"]["type"] = "group"
        services.handle_update(update)
        self.assertEqual(self.sent(), [])


class SellerTests(Base):
    def setUp(self):
        super().setUp()
        self.seller = User.objects.create(username="seller")
        Membership.objects.create(user=self.seller, business=self.business, role="seller")
        Profile.objects.update_or_create(user=self.seller, defaults={"business": self.business})
        TelegramLink.objects.create(user=self.seller, chat_id=600)
        set_consent(self.seller, "ai", True)

    def test_seller_draft_own_no_balances(self):
        services.handle_update(msg(600, "получил 300 тыс от клиента"))
        tx = Transaction.objects.get()
        self.assertEqual((tx.created_by, tx.status), (self.seller, "draft"))
        self.assertNotIn("Остаток", self.last_text())
        services.handle_update(msg(600, "/brief"))
        self.assertIn("недоступна", self.last_text())
        self.assertNotIn("Остаток", self.last_text())

    def test_seller_cannot_confirm_owners_draft(self):
        tx = Transaction.objects.create(business=self.business, account=Account.objects.first(), date=date.today(), amount=5,
                                        direction="out", category="x", status="draft", created_by=self.user)
        services.handle_update({"callback_query": {"id": "q", "from": {"id": 600}, "data": f"ok:{tx.id}",
                                                   "message": {"message_id": 1, "chat": {"id": 600}}}})
        tx.refresh_from_db()
        self.assertEqual(tx.status, "draft")
