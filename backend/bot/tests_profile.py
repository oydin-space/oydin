from io import StringIO
from unittest import mock

import httpx
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import SimpleTestCase, override_settings

from bot import client
from bot.management.commands import set_bot_profile as sbp

ME = {"id": 42}


class FakeBot:
    """Состояние профиля бота; call() отвечает как Bot API."""

    def __init__(self, blank=True, photos=0):
        self.state = {}
        self.photos = photos
        self.menu = {"type": "default"}
        self.calls = []
        if not blank:
            for _, getter, gp, _, wanted, setter, sp in sbp.plan_items():
                self.call(setter, sp)
            self.call("setChatMenuButton", {"menu_button": sbp.menu_button()})
        self.calls.clear()

    def call(self, method, payload=None, **kw):
        payload = payload or {}
        self.calls.append(method)
        lang = payload.get("language_code", "")
        if method == "getMe":
            return ME
        if method == "getUserProfilePhotos":
            return {"total_count": self.photos}
        if method == "getChatMenuButton":
            return self.menu
        if method == "setChatMenuButton":
            self.menu = payload["menu_button"]
            return True
        if method.startswith("set"):
            for key in ("name", "description", "short_description", "commands"):
                if key in payload:
                    self.state[(key, lang)] = payload[key]
            return True
        key = {"getMyName": "name", "getMyDescription": "description", "getMyShortDescription": "short_description"}.get(method)
        if key:
            return {key: self.state.get((key, lang), "")}
        return self.state.get(("commands", lang), [])


@override_settings(TELEGRAM_BOT_TOKEN="123:abc")
class SetBotProfileTests(SimpleTestCase):
    def run_cmd(self, bot, *args):
        out = StringIO()
        with mock.patch("bot.client.call", side_effect=bot.call), mock.patch(
            "bot.client.upload_profile_photo"
        ) as upload:
            call_command("set_bot_profile", *args, stdout=out)
        return out.getvalue(), upload

    def test_sets_everything_when_blank(self):
        bot = FakeBot()
        out, upload = self.run_cmd(bot)
        for method in ("setMyName", "setMyDescription", "setMyShortDescription", "setMyCommands", "setChatMenuButton"):
            self.assertIn(method, bot.calls)
        self.assertEqual(bot.menu["web_app"]["url"], "https://oydin.sayfi.uz/app")
        self.assertEqual(bot.state[("name", "uz")], "Oydin")
        self.assertEqual([c["command"] for c in bot.state[("commands", "en")]], ["start", "brief", "lang", "help", "unlink"])
        upload.assert_called_once()
        self.assertTrue(upload.call_args.args[0].startswith(b"\x89PNG"))
        self.assertIn("~ name[ru]", out)

    def test_idempotent_second_run_makes_no_writes(self):
        bot = FakeBot(blank=False, photos=1)
        out, upload = self.run_cmd(bot)
        self.assertEqual([m for m in bot.calls if m.startswith("set")], [])
        upload.assert_not_called()
        self.assertNotIn("~", out)

    def test_only_differing_field_is_updated(self):
        bot = FakeBot(blank=False, photos=1)
        bot.state[("short_description", "uz")] = "eski"
        self.run_cmd(bot)
        self.assertEqual([m for m in bot.calls if m.startswith("set")], ["setMyShortDescription"])
        self.assertEqual(bot.state[("short_description", "uz")], sbp.SHORT["uz"])

    def test_dry_run_prints_diff_without_writing(self):
        bot = FakeBot()
        out, upload = self.run_cmd(bot, "--dry-run")
        self.assertEqual([m for m in bot.calls if m.startswith("set")], [])
        upload.assert_not_called()
        self.assertIn("~ menu_button", out)
        self.assertIn("~ profile_photo", out)

    def test_photo_check_failure_skips_upload(self):
        bot = FakeBot(blank=False)
        real = bot.call

        def flaky(method, payload=None, **kw):
            if method == "getUserProfilePhotos":
                raise client.BotError(400, "nope")
            return real(method, payload)

        bot.call = flaky
        out, upload = self.run_cmd(bot)
        upload.assert_not_called()
        self.assertIn("? profile_photo", out)

    def test_force_photo_uploads(self):
        bot = FakeBot(blank=False, photos=1)
        _, upload = self.run_cmd(bot, "--force-photo")
        upload.assert_called_once()

    def test_telegram_error_becomes_command_error(self):
        with mock.patch("bot.client.call", side_effect=client.BotError(401, "Unauthorized")):
            with self.assertRaises(CommandError):
                call_command("set_bot_profile", stdout=StringIO())

    def test_asset_is_png(self):
        self.assertTrue((sbp.ASSETS / "profile.png").read_bytes().startswith(b"\x89PNG"))


@override_settings(TELEGRAM_BOT_TOKEN="123:abc")
class UploadProfilePhotoTests(SimpleTestCase):
    def test_multipart_request(self):
        response = mock.Mock()
        response.json.return_value = {"ok": True, "result": True}
        with mock.patch("bot.client.httpx.post", return_value=response) as post:
            self.assertTrue(client.upload_profile_photo(b"png"))
        url = post.call_args.args[0]
        self.assertTrue(url.endswith("/bot123:abc/setMyProfilePhoto"))
        self.assertIn("attach://avatar", post.call_args.kwargs["data"]["photo"])
        self.assertEqual(post.call_args.kwargs["files"]["avatar"][1], b"png")

    def test_api_error_raises(self):
        response = mock.Mock(status_code=400)
        response.json.return_value = {"ok": False, "error_code": 400, "description": "bad"}
        with mock.patch("bot.client.httpx.post", return_value=response):
            with self.assertRaises(client.BotError):
                client.upload_profile_photo(b"png")

    def test_network_error_raises(self):
        with mock.patch("bot.client.httpx.post", side_effect=httpx.ConnectError("x")):
            with self.assertRaises(client.BotError):
                client.upload_profile_photo(b"png")
