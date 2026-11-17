"use client";

import { toast } from "sonner";
import { PromptBar } from "@/components/ai-chat/prompt-bar";
import type { useChat } from "@/lib/use-chat";
import { recordVoice, voiceSupported } from "@/lib/voice";

const PLACEHOLDERS = ["Хватит ли денег на зарплату 10-го?", "Заплатил аренду 4 млн наличкой", "Сколько можно взять себе?", "Какой товар даёт больше маржи?"];
const LABELS = { prompt: "Сообщение Oydin", send: "Отправить", stop: "Остановить" };

/** Нижняя панель ввода: текст + голос. Фокус открывает чат. */
export function ChatDock({ chat, onOpen }: { chat: ReturnType<typeof useChat>; onOpen: () => void }) {
  const onDictate = voiceSupported()
    ? async (stop: AbortSignal) => {
        onOpen();
        try {
          const blob = await recordVoice(stop);
          if (blob.size) void chat.sendVoice(blob);
        } catch (e) {
          const denied = e instanceof DOMException && e.name === "NotAllowedError";
          toast.error(denied ? "Нет доступа к микрофону. Разрешите его в настройках." : "Не удалось записать голос");
        }
        return undefined;
      }
    : undefined;

  return (
    <div className="pb-1 pt-1" onFocusCapture={onOpen}>
      <PromptBar
        background="#ffffff"
        color="#2f2a22"
        sparkColor="#b9a6f0"
        width={760}
        busy={chat.busy}
        placeholders={PLACEHOLDERS}
        labels={LABELS}
        onDictate={onDictate}
        onSend={(text) => {
          onOpen();
          void chat.send(text);
        }}
      />
    </div>
  );
}
