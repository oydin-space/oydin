"use client";

import { motion } from "motion/react";
import { AlertTriangle, ThumbsDown, ThumbsUp } from "lucide-react";
import { Icon } from "@/components/ui";
import type { Account, TransactionInput } from "@/lib/types";
import type { ChatMessage } from "@/lib/use-chat";
import { cn } from "@/lib/utils";
import { AnswerChart } from "./answer-chart";
import { DraftCard } from "./draft-card";
import { RichText } from "./rich-text";
import { useT } from "@/i18n";

const pop = { initial: { opacity: 0, scale: 0.9, y: 10 }, animate: { opacity: 1, scale: 1, y: 0 }, transition: { type: "spring", stiffness: 420, damping: 30, mass: 0.8 } } as const;

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
  const t = useT();
  if (message.role === "user") {
    return (
      <motion.div className="flex origin-bottom-right justify-end pr-2" {...pop}>
        <p className="tail-r max-w-[82%] whitespace-pre-wrap rounded-[1.25rem] bg-lavender px-3.5 py-2 text-[1rem] leading-snug">{message.content}</p>
      </motion.div>
    );
  }
  return (
    <motion.div className="flex origin-bottom-left justify-start pl-2" {...pop}>
      <div className={cn("tail-l max-w-[92%] rounded-[1.25rem] bg-secondary px-3.5 py-2.5 sm:max-w-[85%]", message.error && "bg-peach")}>
        {message.error ? <Icon icon={AlertTriangle} size={16} className="mb-1" /> : null}
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
                aria-label={v ? t("biz.chat.helpful") : t("biz.chat.notHelpful")}
                aria-pressed={message.feedback === v}
                onClick={() => onRate(message.id, message.traceId!, v)}
                className={cn("rounded-full p-1.5 hover:bg-muted", message.feedback === v && "bg-mint text-ink")}
              >
                <Icon icon={v ? ThumbsUp : ThumbsDown} size={16} />
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}

export function TypingBubble() {
  const t = useT();
  return (
    <motion.div className="flex origin-bottom-left justify-start pl-2" {...pop} role="status" aria-label={t("biz.chat.typing")}>
      <div className="tail-l flex items-center gap-1 rounded-[1.25rem] bg-secondary px-4 py-3.5">
        {[0, 1, 2].map((i) => (
          <span key={i} className="size-2 rounded-full bg-muted-foreground" style={{ animation: `typing-dot 1.2s ${i * 0.18}s infinite ease-in-out` }} />
        ))}
      </div>
    </motion.div>
  );
}
