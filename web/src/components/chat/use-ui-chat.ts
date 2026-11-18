"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@/i18n/provider";
import { api, ApiError, post } from "@/lib/api";
import type { AiReplyWithUi } from "@/lib/tools-api";
import type { ChatTurn, Transaction, TransactionInput, VoiceReply } from "@/lib/types";
import type { ChatMessage } from "@/lib/use-chat";

/** Сообщение экрана /app/chat: как в доке, плюс OpenUI-разметка ответа. */
export type UiMessage = ChatMessage & { ui?: string | null; pending?: boolean; images?: string[]; draftCheck?: boolean };

/** Блокирующее состояние: нет согласия на ИИ или роль без доступа. */
export type ChatBlock = "consent" | "forbidden" | null;

export interface UiChat {
  messages: UiMessage[];
  busy: boolean;
  block: ChatBlock;
  send: (text: string, images?: string[]) => Promise<void>;
  sendVoice: (audio: Blob, listening: string) => Promise<void>;
  saveDraft: (id: string, input: TransactionInput) => Promise<boolean>;
  dismissDraft: (id: string) => void;
  rate: (id: string, traceId: string, value: 0 | 1) => Promise<void>;
}

const HISTORY = 20;
const STORAGE = "oydin.chat.";
const EMPTY: UiMessage[] = [];
let seq = 0;

/* Переписка живёт вне компонента и в sessionStorage: переход на другую вкладку и обратно её не теряет.
   Серверной истории сообщений нет; ключ — пользователь и бизнес. */
const cache = new Map<string, UiMessage[]>();
const listeners = new Set<() => void>();

/** Выход/смена аккаунта: стираем переписку в памяти и sessionStorage. */
export function clearChats() {
  cache.clear();
  try {
    for (const key of Object.keys(sessionStorage)) if (key.startsWith(STORAGE)) sessionStorage.removeItem(key);
  } catch {
    /* приватный режим */
  }
  listeners.forEach((l) => l());
}

function load(scope: string): UiMessage[] {
  const hit = cache.get(scope);
  if (hit) return hit;
  let saved: UiMessage[] = EMPTY;
  try {
    const raw = sessionStorage.getItem(STORAGE + scope);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      saved = Array.isArray(parsed) ? (parsed as UiMessage[]) : EMPTY;
    }
  } catch {
    saved = EMPTY;
  }
  cache.set(scope, saved);
  return saved;
}

function store(scope: string, update: (all: UiMessage[]) => UiMessage[]) {
  const next = update(load(scope));
  cache.set(scope, next);
  try {
    // картинки тяжёлые для sessionStorage; «сохраняется» после перезагрузки — снова черновик
    const lean = next
      .filter((m) => !m.pending)
      .map(({ images: _images, ...m }) => (m.draftState === "saving" ? { ...m, draftState: "pending" as const, draftCheck: true } : m));
    sessionStorage.setItem(STORAGE + scope, JSON.stringify(lean));
  } catch {
    /* переполнение или приватный режим — остаётся память вкладки */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Последние реплики для модели: без ошибок и заглушек. */
function turns(all: UiMessage[]): ChatTurn[] {
  return all
    .filter((m) => !m.error && !m.pending && m.content.trim() && (m.role === "user" || m.role === "assistant"))
    .map((m) => ({ role: m.role, content: m.content }))
    .slice(-HISTORY);
}

/** Чат с генеративным UI. Ошибки — код ApiError; текст ошибки рисует экран через i18n.
 *  scope — `${userId}:${businessId}`: у каждого бизнеса своя переписка. */
export function useUiChat(scope: string): UiChat {
  const { locale } = useI18n();
  const messages = useSyncExternalStore(subscribe, () => load(scope), () => EMPTY);
  const [busy, setBusy] = useState(false);
  const [block, setBlock] = useState<ChatBlock>(null);
  const busyRef = useRef(false);

  const setMessages = useCallback((update: (all: UiMessage[]) => UiMessage[]) => store(scope, update), [scope]);

  const patch = useCallback(
    (id: string, p: Partial<UiMessage>) => setMessages((all) => all.map((m) => (m.id === id ? { ...m, ...p } : m))),
    [setMessages],
  );

  /** Общая обёртка запроса: занятость, блокировки 403, сообщение об ошибке. */
  const run = useCallback(async (userText: string, request: (userId: string) => Promise<void>, images?: string[]) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const userId = `m${Date.now().toString(36)}${seq++}`;
    setMessages((all) => [...all.map((m) => ({ ...m, suggestions: undefined })), { id: userId, role: "user", content: userText, images }]);
    try {
      await request(userId);
    } catch (e) {
      if (e instanceof ApiError && e.message === "ai_consent_required") {
        setBlock("consent");
        return;
      }
      if (e instanceof ApiError && e.status === 403) setBlock("forbidden");
      const code = e instanceof ApiError ? e.message : "error";
      setMessages((all) => [...all, { id: `m${Date.now().toString(36)}${seq++}`, role: "assistant", content: code, error: true }]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, [setMessages]);

  const ask = useCallback(
    async (images?: string[]) => {
      const r = await post<AiReplyWithUi>("/ai/chat/", {
        messages: turns(load(scope)),
        lang: locale,
        ...(images?.length ? { images } : {}),
      });
      setMessages((all) => [
        ...all,
        {
          id: `m${Date.now().toString(36)}${seq++}`,
          role: "assistant",
          content: r.reply,
          ui: r.ui ?? null,
          chart: r.ui ? null : r.chart,
          draft: r.draft,
          draftState: r.draft ? "pending" : undefined,
          suggestions: r.suggestions,
          traceId: r.trace_id,
          tools: r.tools_used,
        },
      ]);
    },
    [locale, scope, setMessages],
  );

  const send = useCallback(
    (text: string, images?: string[]) => {
      const content = text.trim();
      if (!content) return Promise.resolve();
      return run(content, () => ask(images), images?.length ? images : undefined);
    },
    [ask, run],
  );

  /** Голос: расшифровка (+ черновик операции, если это трата), затем вопрос текстом. */
  const sendVoice = useCallback(
    (audio: Blob, listening: string) =>
      run(listening, async (userId) => {
        const form = new FormData();
        const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
        form.append("audio", audio, `voice.${ext}`);
        const r = await api<VoiceReply>("/ai/voice/", { method: "POST", body: form });
        patch(userId, { content: r.text });
        if (r.draft) {
          setMessages((all) => [
            ...all,
            { id: `m${Date.now().toString(36)}${seq++}`, role: "assistant", content: r.text, draft: r.draft, draftState: "pending" },
          ]);
        } else if (r.text.trim()) {
          await ask();
        }
      }),
    [ask, patch, run, setMessages],
  );

  const saveDraft = useCallback(
    async (id: string, input: TransactionInput) => {
      patch(id, { draftState: "saving" });
      try {
        await post<Transaction>("/transactions/", input);
        patch(id, { draftState: "saved" });
        return true;
      } catch (e) {
        patch(id, { draftState: "pending" });
        throw e;
      }
    },
    [patch],
  );

  const dismissDraft = useCallback((id: string) => patch(id, { draftState: "dismissed" }), [patch]);

  const rate = useCallback(
    async (id: string, traceId: string, value: 0 | 1) => {
      patch(id, { feedback: value });
      await post("/ai/feedback/", { trace_id: traceId, value }).catch(() => patch(id, { feedback: undefined }));
    },
    [patch],
  );

  return { messages, busy, block, send, sendVoice, saveDraft, dismissDraft, rate };
}
