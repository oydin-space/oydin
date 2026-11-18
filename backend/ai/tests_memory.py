import json
from unittest.mock import patch

from django.contrib.auth import get_user_model
from django.core.cache import cache
from django.test import SimpleTestCase, TestCase, override_settings

from accounts.consent import set_consent
from accounts.models import Business, Membership, Profile

from . import chat, exa, memory, tools
from .models import BusinessProfile, MemoryFact


def make_user(name, business, role):
    user = get_user_model().objects.create(username=name, first_name=name.title())
    Profile.objects.create(user=user, business=business)
    Membership.objects.update_or_create(user=user, business=business, defaults={"role": role})
    set_consent(user, "ai", True)
    return user


class MemoryBase(TestCase):
    def setUp(self):
        cache.clear()
        self.biz = Business.objects.create(name="Бизнес", industry="Печать")
        self.other_biz = Business.objects.create(name="Чужой")
        self.owner = make_user("owner", self.biz, Membership.Role.OWNER)
        self.acc = make_user("acc", self.biz, Membership.Role.ACCOUNTANT)
        self.seller = make_user("seller", self.biz, Membership.Role.SELLER)
        self.stranger = make_user("stranger", self.other_biz, Membership.Role.OWNER)


class MemoryServiceTests(MemoryBase):
    def test_remember_scopes_and_dedupe(self):
        r = memory.remember(self.biz, self.owner, "owner", "business", "  Работаем с 9 до 18 ")
        self.assertEqual(r["fact"]["text"], "Работаем с 9 до 18")
        self.assertTrue(memory.remember(self.biz, self.owner, "owner", "business", "работаем с 9 до 18")["duplicate"])
        self.assertEqual(MemoryFact.objects.count(), 1)
        self.assertIn("error", memory.remember(self.biz, self.owner, "owner", "team", "x"))
        self.assertIn("error", memory.remember(self.biz, self.owner, "owner", "user", "  "))

    def test_text_is_truncated_and_capped(self):
        r = memory.remember(self.biz, self.owner, "owner", "user", "я" * 1000)
        self.assertEqual(len(r["fact"]["text"]), memory.MAX_TEXT)
        for i in range(memory.MAX_FACTS):
            memory.remember(self.biz, self.owner, "owner", "user", f"факт {i}")
        self.assertIn("error", memory.remember(self.biz, self.owner, "owner", "user", "лишний"))

    def test_visibility(self):
        memory.remember(self.biz, self.owner, "owner", "business", "общий")
        memory.remember(self.biz, self.owner, "owner", "user", "личный владельца")
        memory.remember(self.biz, self.seller, "seller", "user", "личный продавца")
        memory.remember(self.other_biz, self.stranger, "owner", "business", "чужой бизнес")
        texts = lambda u, role: {f.text for f in memory.visible(self.biz, u, role)}
        self.assertEqual(texts(self.owner, "owner"), {"общий", "личный владельца"})
        self.assertEqual(texts(self.acc, "accountant"), {"общий"})
        self.assertEqual(texts(self.seller, "seller"), {"личный продавца"})

    def test_seller_cannot_write_business_memory(self):
        self.assertEqual(memory.remember(self.biz, self.seller, "seller", "business", "x"), {"error": "forbidden"})

    def test_forget_scoping(self):
        mine = memory.remember(self.biz, self.owner, "owner", "user", "мой")["fact"]["id"]
        shared = memory.remember(self.biz, self.owner, "owner", "business", "общий")["fact"]["id"]
        self.assertIn("error", memory.forget(self.biz, self.acc, "accountant", mine))
        self.assertIn("error", memory.forget(self.biz, self.seller, "seller", shared))
        self.assertIn("error", memory.forget(self.other_biz, self.stranger, "owner", shared))
        self.assertIn("error", memory.forget(self.biz, self.owner, "owner", "abc"))
        self.assertEqual(MemoryFact.objects.count(), 2)
        self.assertTrue(memory.forget(self.biz, self.acc, "accountant", shared)["ok"])
        self.assertTrue(memory.forget(self.biz, self.owner, "owner", mine)["ok"])
        self.assertEqual(MemoryFact.objects.count(), 0)

    def test_context_for_owner_and_seller(self):
        BusinessProfile.objects.create(business=self.biz, inn="123456789", plans="Второй цех", problems="Кассовые разрывы")
        memory.remember(self.biz, self.owner, "owner", "business", "общий")
        ctx = memory.get_context(self.biz, self.owner, "owner", "ru")
        self.assertEqual(ctx["user"]["role"], "owner")
        self.assertEqual(ctx["user"]["lang"], "ru")
        self.assertEqual(ctx["business"], {"name": "Бизнес", "inn": "123456789", "activity": "Печать", "plans": "Второй цех", "problems": "Кассовые разрывы"})
        self.assertEqual([f["text"] for f in ctx["memory"]], ["общий"])
        self.assertIn("ИНН: 123456789", memory.compact(ctx))
        seller_ctx = memory.get_context(self.biz, self.seller, "seller")
        self.assertNotIn("business", seller_ctx)
        self.assertEqual(seller_ctx["memory"], [])


class ToolRegistryTests(MemoryBase):
    def test_context_tools_registered_and_callable(self):
        r = tools.run_context_tool(self.biz, "remember", {"scope": "user", "text": "люблю кратко"}, self.owner, "owner")
        self.assertTrue(r["ok"])
        ctx = tools.run_context_tool(self.biz, "get_context", {}, self.owner, "owner", "uz")
        self.assertEqual(ctx["memory"][0]["text"], "люблю кратко")
        fid = ctx["memory"][0]["id"]
        self.assertTrue(tools.run_context_tool(self.biz, "forget", {"id": fid}, self.owner, "owner")["ok"])
        self.assertIn("error", tools.run_context_tool(self.biz, "nope", {}, self.owner, "owner"))
        self.assertIn("error", tools.run_context_tool(self.biz, "remember", "bad", self.owner, "owner"))

    @override_settings(EXA_API="")
    def test_web_tools_hidden_without_key(self):
        self.assertNotIn("web_search", tools.tools_help())
        self.assertIn("error", tools.run_context_tool(self.biz, "web_search", {"query": "q"}, self.owner, "owner"))
        self.assertIn("remember", tools.tools_help())

    @override_settings(EXA_API="k")
    def test_web_tools_listed_with_key(self):
        self.assertIn("web_search", tools.tools_help())
        self.assertIn("research", tools.tools_help())


@override_settings(EXA_API="test-key")
class ExaTests(SimpleTestCase):
    def test_search_caps_results_and_sends_key(self):
        payload = {"results": [{"title": f"t{i}", "url": f"https://e.com/{i}", "text": "x" * 2000} for i in range(9)] + [{"title": "no url"}]}
        with patch("ai.exa._post", return_value=payload) as post:
            r = exa.web_search({"query": "  курс доллара  "})
        path, body = post.call_args.args
        self.assertEqual(path, "/search")
        self.assertEqual(body["query"], "курс доллара")
        self.assertEqual(len(r["results"]), exa.MAX_RESULTS)
        self.assertTrue(all(x["url"].startswith("https://") and len(x["snippet"]) <= exa.SNIPPET for x in r["results"]))

    def test_research_returns_answer_with_sources(self):
        data = {"answer": "Ставка 4%", "citations": [{"title": "ЦБ", "url": "https://cbu.uz"}, {"title": "x"}]}
        with patch("ai.exa._post", return_value=data) as post:
            r = exa.research({"query": "ставка"})
        self.assertEqual(post.call_args.args[0], "/answer")
        self.assertEqual(r["answer"], "Ставка 4%")
        self.assertEqual(r["sources"], [{"title": "ЦБ", "url": "https://cbu.uz"}])

    def test_http_error_is_contained(self):
        with patch("ai.exa._post", side_effect=TimeoutError):
            self.assertEqual(exa.web_search({"query": "q"}), {"error": "web_search_unavailable"})
            self.assertEqual(exa.research({"query": "q"}), {"error": "web_search_unavailable"})

    def test_validation(self):
        self.assertIn("error", exa.web_search({}))
        self.assertIn("error", exa.research({"query": 5}))

    @override_settings(EXA_API="")
    def test_disabled_makes_no_call(self):
        with patch("ai.exa._post") as post:
            self.assertEqual(exa.web_search({"query": "q"}), {"error": "web_search_disabled"})
            self.assertEqual(exa.research({"query": "q"}), {"error": "web_search_disabled"})
        post.assert_not_called()


class MemoryApiTests(MemoryBase):
    def login(self, user):
        self.client.force_login(user)

    def test_list_and_delete(self):
        mine = memory.remember(self.biz, self.owner, "owner", "user", "мой")["fact"]["id"]
        memory.remember(self.biz, self.owner, "owner", "business", "общий")
        memory.remember(self.biz, self.acc, "accountant", "user", "личный бухгалтера")
        self.login(self.owner)
        r = self.client.get("/api/ai/memory/")
        self.assertEqual(r.status_code, 200)
        self.assertEqual({i["text"] for i in r.json()["items"]}, {"мой", "общий"})
        self.assertEqual(self.client.delete(f"/api/ai/memory/{mine}/").status_code, 204)
        self.assertEqual(self.client.delete(f"/api/ai/memory/{mine}/").status_code, 404)

    def test_cannot_delete_foreign_facts(self):
        theirs = memory.remember(self.biz, self.acc, "accountant", "user", "личный")["fact"]["id"]
        foreign = memory.remember(self.other_biz, self.stranger, "owner", "business", "чужой")["fact"]["id"]
        self.login(self.owner)
        self.assertEqual(self.client.delete(f"/api/ai/memory/{theirs}/").status_code, 404)
        self.assertEqual(self.client.delete(f"/api/ai/memory/{foreign}/").status_code, 404)
        self.assertEqual(MemoryFact.objects.count(), 2)

    def test_seller_forbidden(self):
        self.login(self.seller)
        self.assertEqual(self.client.get("/api/ai/memory/").status_code, 403)

    def test_consent_required(self):
        set_consent(self.owner, "ai", False)
        self.login(self.owner)
        r = self.client.get("/api/ai/memory/")
        self.assertEqual((r.status_code, r.json()["error"]), (403, "ai_consent_required"))

    def test_anonymous(self):
        self.assertEqual(self.client.get("/api/ai/memory/").status_code, 401)


class ChatLoopTests(MemoryBase):
    def run_chat(self, replies):
        calls = []

        def fake(system, convo, **kw):
            calls.append((system, convo))
            return replies[len(calls) - 1]

        with patch("ai.llm.complete", side_effect=fake):
            result = chat.answer(self.biz, self.owner, [{"role": "user", "content": "Запомни: работаем без выходных"}], "owner")
        return result, calls

    @override_settings(EXA_API="k")
    def test_chat_calls_remember_and_injects_context(self):
        memory.remember(self.biz, self.owner, "owner", "business", "ранее известный факт")
        result, calls = self.run_chat([
            {"tool": "remember", "args": {"scope": "business", "text": "работаем без выходных"}},
            {"reply": "Запомнил.", "suggestions": []},
        ])
        self.assertFalse(result["fallback"])
        self.assertTrue(MemoryFact.objects.filter(text="работаем без выходных", scope="business").exists())
        system = calls[0][0]
        self.assertIn("ранее известный факт", system)
        self.assertIn("web_search", system)
        self.assertIn("remember", system)

    @override_settings(EXA_API="k")
    def test_chat_calls_web_search(self):
        with patch("ai.exa._post", return_value={"results": [{"title": "T", "url": "https://e.com", "text": "s"}]}):
            result, calls = self.run_chat([
                {"tool": "web_search", "args": {"query": "q"}},
                {"reply": "Нашёл: https://e.com", "suggestions": []},
            ])
        self.assertIn("https://e.com", calls[1][1][-1]["content"])
        self.assertFalse(result["fallback"])

    def test_chat_role_defaults_to_membership(self):
        with patch("ai.llm.complete", return_value={"reply": "ок", "suggestions": []}) as c:
            chat.answer(self.biz, self.owner, [{"role": "user", "content": "привет"}])
        self.assertIn("роль owner", c.call_args.args[0])
