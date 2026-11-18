"use client";

import { useCallback, useRef, useState } from "react";
import { api, ApiError, post } from "@/lib/api";
import type { AiReplyWithUi } from "@/lib/tools-api";
import type { ChatTurn, Transaction, TransactionInput, VoiceReply } from "@/lib/types";
import type { ChatMessage } from "@/lib/use-chat";

/** Сообщение экрана /app/chat: как в доке, плюс OpenUI-разметка ответа. */
export type UiMessage = ChatMessage & { ui?: string | null; pending?: boolean };

/** Блокирующее состояние: нет согласия на ИИ или роль без доступа. */
export type ChatBlock = "consent" | "forbidden" | null;

export interface UiChat {
  messages: UiMessage[];
  busy: boolean;
  block: ChatBlock;
  send: (text: string) => Promise<void>;
  sendVoice: (audio: Blob, listening: string) => Promise<void>;
  saveDraft: (id: string, input: TransactionInput) => Promise<boolean>;
  dismissDraft: (id: string) => void;
  rate: (id: string, traceId: string, value: 0 | 1) => Promise<void>;
}

const HISTORY = 20;
let seq = 0;

/** Чат с генеративным UI. Ошибки — код ApiError; текст ошибки рисует экран через i18n. */
export function useUiChat(): UiChat {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const [block, setBlock] = useState<ChatBlock>(null);
  const history = useRef<ChatTurn[]>([]);
  const busyRef = useRef(false);

  const patch = useCallback((id: string, p: Partial<UiMessage>) => {
    setMessages((all) => all.map((m) => (m.id === id ? { ...m, ...p } : m)));
  }, []);

  /** Общая обёртка запроса: занятость, блокировки 403, сообщение об ошибке. */
  const run = useCallback(async (userText: string, request: (userId: string) => Promise<void>) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const userId = `m${Date.now().toString(36)}${seq++}`;
    setMessages((all) => [...all.map((m) => ({ ...m, suggestions: undefined })), { id: userId, role: "user", content: userText }]);
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
  }, []);

  const ask = useCallback(
    async (text: string) => {
      history.current = [...history.current, { role: "user" as const, content: text }].slice(-HISTORY);
      try {
        const r = await post<AiReplyWithUi>("/ai/chat/", { messages: history.current });
        history.current = [...history.current, { role: "assistant" as const, content: r.reply }].slice(-HISTORY);
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
          },
        ]);
      } catch (e) {
        history.current = history.current.slice(0, -1);
        throw e;
      }
    },
    [],
  );

  const send = useCallback(
    (text: string) => {
      const content = text.trim();
      if (!content) return Promise.resolve();
      return run(content, () => ask(content));
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
          await ask(r.text.trim());
        }
      }),
    [ask, patch, run],
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
