"use client";

import { Check, Loader2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { ChatMessage } from "@/lib/use-chat";
import type { Account, Direction, Purpose, TransactionInput } from "@/lib/types";
import { money, todayIso, dateShort } from "@/lib/format";
import { cn } from "@/lib/utils";

const DIRECTION: Record<Direction, string> = { in: "Приход", out: "Расход", transfer: "Перевод между счетами" };

/** Черновик операции: ничего не сохраняется, пока пользователь не нажмёт «Сохранить». */
export function DraftCard({
  message,
  accounts,
  onSave,
  onDismiss,
}: {
  message: ChatMessage;
  accounts: Account[];
  onSave: (input: TransactionInput) => Promise<boolean>;
  onDismiss: () => void;
}) {
  const draft = message.draft!;
  const state = message.draftState ?? "pending";
  const [purpose, setPurpose] = useState<Purpose>(draft.purpose && draft.purpose !== "unclear" ? draft.purpose : "business");
  const account = accounts.find((a) => a.id === draft.account_id);
  const isOut = draft.direction === "out";

  if (state === "dismissed") return null;

  const save = async () => {
    try {
      await onSave({ ...draft, date: draft.date ?? todayIso(), purpose });
      toast.success("Операция сохранена");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось сохранить");
    }
  };

  return (
    <div className="brush mt-3 rounded-2xl bg-butter p-3.5" role="group" aria-label="Черновик операции">
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-ink/70">{DIRECTION[draft.direction]} · {dateShort(draft.date ?? todayIso())}</span>
        <span className="tabular text-xl font-semibold">
          {isOut ? "−" : draft.direction === "in" ? "+" : ""}
          {money(draft.amount)}
        </span>
      </div>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        <dt className="text-ink/60">Категория</dt>
        <dd>{draft.category}</dd>
        <dt className="text-ink/60">Счёт</dt>
        <dd>{account?.name ?? `№${draft.account_id}`}</dd>
        {draft.counterparty ? (
          <>
            <dt className="text-ink/60">Контрагент</dt>
            <dd>{draft.counterparty}</dd>
          </>
        ) : null}
        {draft.note ? (
          <>
            <dt className="text-ink/60">Заметка</dt>
            <dd>{draft.note}</dd>
          </>
        ) : null}
      </dl>
      {draft.direction !== "transfer" ? (
        <div className="mt-3 inline-flex rounded-full bg-white/70 p-0.5" role="radiogroup" aria-label="Тип траты">
          {(["business", "personal"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={purpose === p}
              disabled={state !== "pending"}
              onClick={() => setPurpose(p)}
              className={cn("rounded-full px-3.5 py-1.5 text-sm transition-colors", purpose === p ? "bg-ink text-card shadow-sm" : "text-ink/70")}
            >
              {p === "business" ? "Целевая" : "Нецелевая"}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex items-center gap-2">
        {state === "saved" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-2 text-sm font-medium">
            <Check size={16} /> Сохранено
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={save}
              disabled={state === "saving"}
              className="inline-flex items-center gap-1.5 rounded-full bg-ink px-5 py-2 text-sm font-medium text-card shadow-sm transition active:scale-95 disabled:opacity-60"
            >
              {state === "saving" ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />} Сохранить
            </button>
            <button type="button" onClick={onDismiss} className="inline-flex items-center gap-1 rounded-full px-3 py-2 text-sm text-ink/70 active:scale-95">
              <X size={15} /> Не сохранять
            </button>
          </>
        )}
      </div>
    </div>
  );
}
