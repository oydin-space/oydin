"""Привязка чата и разбор входящих сообщений Telegram."""

import base64
import hashlib
import logging
import secrets
from datetime import timedelta

from django.conf import settings
from django.db import transaction
from django.utils import timezone

from accounts.http import ApiError
from accounts.access import SELLER, active_membership
from accounts.consent import has_consent
from accounts.models import Profile
from ai import draft as drafts
from ai import llm
from ai.views import throttle
from finance.models import Account, Transaction
from finance.services import confirm_draft, today

from . import client, texts
from .models import LinkCode, TelegramLink

log = logging.getLogger(__name__)
LINK_TTL = timedelta(minutes=15)
MAX_FILE = 5 * 1024 * 1024
BIND_PREFIX = 32  # длина префикса хеша кода в callback_data (лимит Telegram 64 байта)


def _hash(code):
    return hashlib.sha256(code.encode()).hexdigest()


def create_link_code(user):
    code = secrets.token_urlsafe(16)
    LinkCode.objects.filter(user=user).delete()
    LinkCode.objects.create(user=user, code_hash=_hash(code), expires_at=timezone.now() + LINK_TTL)
    return code


def bind(user, chat_id, username="", lang="ru"):
    with transaction.atomic():
        link, _ = TelegramLink.objects.update_or_create(
            user=user, defaults={"chat_id": chat_id, "username": username[:64], "lang": texts.norm(lang)})
        LinkCode.objects.filter(user=user).delete()
    return link


def pending_code(code_hash, prefix=False):
    """Живой код привязки по полному хешу или его префиксу; просроченный удаляется."""
    rows = LinkCode.objects.filter(code_hash__startswith=code_hash) if prefix else LinkCode.objects.filter(code_hash=code_hash)
    row = rows.select_related("user").first()
    if row is not None and row.expired():
        row.delete()
        return None
    return row


def say(chat_id, text, buttons=None):
    payload = {"chat_id": chat_id, "text": text}
    if buttons:
        payload["reply_markup"] = {"inline_keyboard": [buttons]}
    return client.call("sendMessage", payload)


def _lang_of(sender):
    code = (sender.get("language_code") or "")[:2]
    return code if code in texts.LANGS else texts.DEFAULT


def handle_update(update):
    if "callback_query" in update:
        return handle_callback(update["callback_query"])
    message = update.get("message")
    if not message or message.get("chat", {}).get("type") != "private":
        return
    chat_id = message["chat"]["id"]
    sender = message.get("from") or {}
    link = TelegramLink.objects.filter(chat_id=chat_id).select_related("user").first()
    text = (message.get("text") or "").strip()
    if text.startswith("/"):
        return handle_command(chat_id, sender, link, text)
    lang = link.lang if link else _lang_of(sender)
    if link is None:
        return say(chat_id, texts.tr("need_link", lang))
    if message.get("photo"):
        largest = message["photo"][-1]
        return handle_content(link, chat_id, photo=largest["file_id"], size=largest.get("file_size") or 0,
                              text=message.get("caption") or "")
    if text:
        return handle_content(link, chat_id, text=text)


def handle_command(chat_id, sender, link, text):
    parts = text.split()
    command = parts[0].split("@")[0].lower()
    arg = parts[1] if len(parts) > 1 else ""
    lang = link.lang if link else _lang_of(sender)
    if command == "/start":
        return handle_start(chat_id, sender, link, arg)
    if command == "/help":
        return say(chat_id, texts.tr("help", lang))
    if link is None:
        return say(chat_id, texts.tr("need_link", lang))
    if command == "/unlink":
        link.delete()
        return say(chat_id, texts.tr("unlinked", lang))
    if command == "/brief":
        from . import jobs

        membership = active_membership(link.user)
        if membership is None:
            return say(chat_id, texts.tr("no_business", lang))
        if membership.role == SELLER:
            return say(chat_id, texts.tr("no_finance", lang))
        return say(chat_id, jobs.brief_text(membership.business, lang))
    if command == "/lang":
        if arg in texts.LANGS:
            link.lang = arg
            link.save(update_fields=["lang"])
            return say(chat_id, texts.tr("lang_set", arg))
        return say(chat_id, texts.tr("choose_lang", lang), [{"text": c, "callback_data": f"lang:{c}"} for c in texts.LANGS])
    return say(chat_id, texts.tr("help", lang))


def handle_start(chat_id, sender, link, code):
    lang = link.lang if link else _lang_of(sender)
    username = sender.get("username") or ""
    if code:
        row = pending_code(_hash(code))
        if row is None or not row.user.is_active:
            return say(chat_id, texts.tr("bad_code", lang))
        if link and link.user_id != row.user_id:
            return say(chat_id, texts.tr("linked_other", lang))
        membership = active_membership(row.user)
        who = row.user.email or row.user.get_full_name() or row.user.get_username()
        return say(chat_id, texts.tr("confirm_bind", lang, who=who, business=membership.business.name if membership else "—"),
                   [{"text": texts.tr("btn_bind", lang), "callback_data": f"bind:{row.code_hash[:BIND_PREFIX]}"}])
    if link:
        return say(chat_id, texts.tr("welcome", lang))
    profile = Profile.objects.filter(telegram_id=sender.get("id")).select_related("user").first() if sender.get("id") else None
    if profile and profile.user.is_active and not (profile.user.is_staff or profile.user.is_superuser):
        new = bind(profile.user, chat_id, username, lang)
        return say(chat_id, texts.tr("linked", new.lang) + "\n\n" + texts.tr("welcome", new.lang))
    return say(chat_id, texts.tr("need_link", lang))


def confirm_bind(query, chat_id, value):
    """Нажата кнопка «Привязать»: код одноразовый, действует LINK_TTL."""
    answer = {"callback_query_id": query.get("id")}
    sender = query.get("from") or {}
    lang = _lang_of(sender)
    existing = TelegramLink.objects.filter(chat_id=chat_id).first()
    row = pending_code(value, prefix=True) if len(value) == BIND_PREFIX else None
    if row is None or not row.user.is_active or (existing and existing.user_id != row.user_id):
        return client.call("answerCallbackQuery", {**answer, "text": texts.tr("bad_code", lang)})
    new = bind(row.user, chat_id, sender.get("username") or "", lang)
    client.call("answerCallbackQuery", answer)
    return say(chat_id, texts.tr("linked", new.lang) + "\n\n" + texts.tr("welcome", new.lang))


SYSTEM = (
    "Ты извлекаешь одну финансовую операцию из сообщения владельца малого бизнеса в Узбекистане: свободный текст, "
    "банковское SMS или фото чека. Ответь JSON-объектом: {\"amount\": целое число в сумах, \"direction\": \"in\"|\"out\", "
    "\"category\": коротко, \"purpose\": \"business\"|\"personal\"|\"unclear\", \"account_id\": число из списка счетов, "
    "\"counterparty\": строка, \"note\": строка}. Если операции нет, верни {\"amount\": 0}. Счета: %s."
)


def _llm_draft(business, text, image=None):
    accounts = ", ".join(f"{a.id}={a.name} ({a.kind})" for a in Account.objects.filter(business=business))
    content = [{"type": "text", "text": text or "Извлеки операцию из чека."}]
    if image:
        data, mime = image
        content.append({"type": "image_url", "image_url": {"url": f"data:{mime};base64,{base64.b64encode(data).decode()}"}})
    return drafts.validate_draft(business, llm.complete(SYSTEM % accounts, [{"role": "user", "content": content}],
                                                        name="bot_draft"))


def handle_content(link, chat_id, text="", photo=None, size=0):
    lang = link.lang
    if not link.user.is_active:
        return
    membership = active_membership(link.user)
    if membership is None:
        return say(chat_id, texts.tr("no_business", lang))
    if membership.role == SELLER:
        return say(chat_id, texts.tr("no_ai_role", lang))
    if not has_consent(link.user, "ai"):
        return say(chat_id, texts.tr("need_consent", lang))
    if photo and size > MAX_FILE:
        return say(chat_id, texts.tr("too_big", lang))
    try:
        throttle(link.user, "bot", settings.AI_CHAT_PER_MINUTE)
    except ApiError:
        return say(chat_id, texts.tr("throttled", lang))
    business = membership.business
    try:
        if photo:
            try:
                image = client.download_file(photo)
            except client.BotError:
                return say(chat_id, texts.tr("photo_fail", lang))
            draft = _llm_draft(business, text, image)
        else:
            draft = drafts.parse_text_draft(business, text) or _llm_draft(business, text)
    except llm.AiUnavailable:
        return say(chat_id, texts.tr("ai_down", lang))
    if draft is None or draft["direction"] not in ("in", "out"):
        return say(chat_id, texts.tr("unparsed", lang))
    account = Account.objects.get(pk=draft["account_id"])
    tx = Transaction.objects.create(
        business=business, account=account, date=today(), amount=draft["amount"], direction=draft["direction"],
        category=draft["category"], purpose=draft["purpose"], counterparty=draft["counterparty"] or None,
        note=draft["note"], status=Transaction.Status.DRAFT, source=Transaction.Source.CHAT, created_by=link.user)
    say(chat_id, texts.build_draft(lang, draft, account.name), [
        {"text": texts.tr("btn_ok", lang), "callback_data": f"ok:{tx.id}"},
        {"text": texts.tr("btn_no", lang), "callback_data": f"no:{tx.id}"},
    ])


def handle_callback(query):
    chat_id = (query.get("message") or {}).get("chat", {}).get("id")
    message_id = (query.get("message") or {}).get("message_id")
    link = TelegramLink.objects.filter(chat_id=chat_id).select_related("user").first() if chat_id else None
    action, _, value = (query.get("data") or "").partition(":")
    answer = {"callback_query_id": query.get("id")}
    if action == "bind" and chat_id and (query.get("from") or {}).get("id") is not None:
        return confirm_bind(query, chat_id, value)
    if link is None or (query.get("from") or {}).get("id") is None:
        return client.call("answerCallbackQuery", answer)
    lang = link.lang
    if action == "lang" and value in texts.LANGS:
        link.lang = value
        link.save(update_fields=["lang"])
        client.call("answerCallbackQuery", answer)
        return say(chat_id, texts.tr("lang_set", value))
    membership = active_membership(link.user)
    tx = None
    if action in ("ok", "no") and value.isdigit() and membership:
        tx = Transaction.objects.filter(
            pk=int(value), business=membership.business, created_by=link.user, status=Transaction.Status.DRAFT).first()
    if tx is None:
        return client.call("answerCallbackQuery", {**answer, "text": texts.tr("gone", lang)})
    if action == "ok":
        confirm_draft(tx)
        done = texts.tr("confirmed", lang)
    else:
        tx.delete()
        done = texts.tr("cancelled", lang)
    client.call("answerCallbackQuery", {**answer, "text": done})
    if message_id:
        client.call("editMessageReplyMarkup", {"chat_id": chat_id, "message_id": message_id, "reply_markup": {"inline_keyboard": []}})
    return say(chat_id, done)
