"use client";

import { StickToBottom } from "use-stick-to-bottom";
import { LogoSpinner } from "@/components/brand/logo-spinner";
import type { Account } from "@/lib/types";
import type { useChat } from "@/lib/use-chat";
import { ChatBubble } from "./chat-message";

export const STARTERS = ["Хватит ли денег на зарплату?", "Сколько могу взять себе?", "Заплатил аренду 4 млн наличкой", "Что с налогами в этом месяце?"];

type Chat = ReturnType<typeof useChat>;

export function ChatPanel({ chat, accounts }: { chat: Chat; accounts: Account[] }) {
  const last = chat.messages.at(-1);
  const chips = last?.role === "assistant" && last.suggestions?.length ? last.suggestions : chat.messages.length ? [] : STARTERS;
  return (
    <StickToBottom className="relative min-h-0 flex-1" resize="smooth" initial="instant">
      <StickToBottom.Content className="flex flex-col gap-3 px-1 py-2">
        {!chat.messages.length ? <p className="px-2 pt-2 text-center text-sm text-muted-foreground">Спросите про деньги или надиктуйте трату</p> : null}
        {chat.messages.map((m) => (
          <ChatBubble key={m.id} message={m} accounts={accounts} onSave={chat.saveDraft} onDismiss={chat.dismissDraft} onRate={chat.rate} />
        ))}
        {chat.busy ? (
          <div className="flex items-center gap-2 px-2 text-sm text-muted-foreground" role="status">
            <LogoSpinner size={24} /> Думаю…
          </div>
        ) : null}
        {chips.length && !chat.busy ? (
          <div className="flex flex-wrap gap-2 px-1">
            {chips.map((s) => (
              <button key={s} type="button" onClick={() => chat.send(s)} className="rounded-full bg-butter px-3.5 py-1.5 text-sm active:scale-95">
                {s}
              </button>
            ))}
          </div>
        ) : null}
      </StickToBottom.Content>
    </StickToBottom>
  );
}
