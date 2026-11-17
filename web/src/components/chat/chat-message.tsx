"use client";

import { ThumbsDown, ThumbsUp } from "lucide-react";
import type { Account, TransactionInput } from "@/lib/types";
import type { ChatMessage } from "@/lib/use-chat";
import { cn } from "@/lib/utils";
import { AnswerChart } from "./answer-chart";
import { DraftCard } from "./draft-card";
import { RichText } from "./rich-text";

export function ChatBubble({
  message,
  accounts,
  onSave,
  onDismiss,
  onRate,
}: {
  message: ChatMessage;
  accounts: Account[];
  onSave: (id: string, input: TransactionInput) => Promise<boolean>;
  onDismiss: (id: string) => void;
  onRate: (id: string, traceId: string, value: 0 | 1) => void;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <p className="max-w-[85%] whitespace-pre-wrap rounded-3xl rounded-br-lg bg-lavender px-4 py-2.5 text-[0.95rem]">{message.content}</p>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className={cn("w-full max-w-[92%] rounded-3xl rounded-bl-lg bg-card px-4 py-3 shadow-sm ring-1 ring-border sm:max-w-[85%]", message.error && "bg-peach/60")}>
        <RichText>{message.content}</RichText>
        {message.chart ? <AnswerChart chart={message.chart} /> : null}
        {message.draft ? (
          <DraftCard message={message} accounts={accounts} onSave={(i) => onSave(message.id, i)} onDismiss={() => onDismiss(message.id)} />
        ) : null}
        {message.traceId ? (
          <div className="mt-2 flex gap-1 text-ink/50">
            {([1, 0] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-label={v ? "Полезный ответ" : "Неполезный ответ"}
                aria-pressed={message.feedback === v}
                onClick={() => onRate(message.id, message.traceId!, v)}
                className={cn("rounded-full p-1.5 hover:bg-muted", message.feedback === v && "bg-mint text-ink")}
              >
                {v ? <ThumbsUp size={14} /> : <ThumbsDown size={14} />}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
