"use client";

import { useCallback, useRef, useState } from "react";
import { haptic } from "./telegram";
import { ApiError, api, post } from "./api";
import type { PersonDraft } from "./people-api";
import type { AiReply, Chart, ChatTurn, Transaction, TransactionInput, VoiceReply } from "./types";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  chart?: Chart | null;
  draft?: TransactionInput | null;
  draftState?: "pending" | "saving" | "saved" | "dismissed";
  personDraft?: PersonDraft | null;
  personDraftState?: "pending" | "saving" | "saved" | "dismissed";
  suggestions?: string[];
  traceId?: string | null;
  tools?: string[];
  feedback?: 0 | 1;
  error?: boolean;
}

let seq = 0;
const nextId = () => `m${Date.now().toString(36)}${seq++}`;

function describeError(e: unknown): string {
  if (e instanceof ApiError && e.status === 429) return "Слишком много запросов. Подождите минуту и спросите снова.";
  return e instanceof Error ? e.message : "Что-то пошло не так";
}

export function useChat({ onSaved }: { onSaved?: () => void } = {}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [busy, setBusy] = useState(false);
  const history = useRef<ChatTurn[]>([]);
  const busyRef = useRef(false);

  const patch = useCallback((id: string, p: Partial<ChatMessage>) => {
    setMessages((all) => all.map((m) => (m.id === id ? { ...m, ...p } : m)));
  }, []);

  const send = useCallback(async (text: string) => {
    const content = text.trim();
    if (!content || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setMessages((all) => [...all.map((m) => ({ ...m, suggestions: undefined })), { id: nextId(), role: "user", content }]);
    history.current = [...history.current, { role: "user" as const, content }].slice(-20);
    try {
      const r = await post<AiReply>("/ai/chat/", { messages: history.current });
      history.current = [...history.current, { role: "assistant" as const, content: r.reply }].slice(-20);
      setMessages((all) => [
        ...all,
        {
          id: nextId(),
          role: "assistant",
          content: r.reply,
          chart: r.chart,
          draft: r.draft,
          draftState: r.draft ? "pending" : undefined,
          suggestions: r.suggestions,
          traceId: r.trace_id,
        },
      ]);
    } catch (e) {
      history.current = history.current.slice(0, -1);
      setMessages((all) => [...all, { id: nextId(), role: "assistant", content: describeError(e), error: true }]);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const sendVoice = useCallback(async (audio: Blob) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const userId = nextId();
    setMessages((all) => [...all.map((m) => ({ ...m, suggestions: undefined })), { id: userId, role: "user", content: "🎙 Слушаю запись…" }]);
    try {
      const form = new FormData();
      const ext = audio.type.includes("mp4") ? "m4a" : audio.type.includes("ogg") ? "ogg" : "webm";
      form.append("audio", audio, `voice.${ext}`);
      const r = await api<VoiceReply>("/ai/voice/", { method: "POST", body: form });
      setMessages((all) => [
        ...all.map((m) => (m.id === userId ? { ...m, content: r.text || "(голосовое сообщение)" } : m)),
        {
          id: nextId(),
          role: "assistant",
          content: r.draft ? "Вот что я понял из голоса. Проверьте и сохраните одним тапом." : "Не смог выделить операцию из записи. Попробуйте сказать суммой и назначением, например: «заплатил аренду 4 миллиона наличкой».",
          draft: r.draft,
          draftState: r.draft ? "pending" : undefined,
        },
      ]);
      haptic(r.draft ? "success" : "tap");
    } catch (e) {
      setMessages((all) => [...all.filter((m) => m.id !== userId), { id: nextId(), role: "assistant", content: describeError(e), error: true }]);
      haptic("error");
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }, []);

  const saveDraft = useCallback(
    async (id: string, input: TransactionInput) => {
      patch(id, { draftState: "saving" });
      try {
        await post<Transaction>("/transactions/", input);
        patch(id, { draftState: "saved" });
        onSaved?.();
        return true;
      } catch (e) {
        patch(id, { draftState: "pending" });
        throw e;
      }
    },
    [onSaved, patch],
  );

  const dismissDraft = useCallback((id: string) => patch(id, { draftState: "dismissed" }), [patch]);

  const rate = useCallback(
    async (id: string, traceId: string, value: 0 | 1) => {
      patch(id, { feedback: value });
      await post("/ai/feedback/", { trace_id: traceId, value }).catch(() => patch(id, { feedback: undefined }));
    },
    [patch],
  );

  return { messages, busy, send, sendVoice, saveDraft, dismissDraft, rate };
}
