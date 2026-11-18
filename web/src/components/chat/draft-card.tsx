"use client";

import { ArrowDownLeft, ArrowLeftRight, ArrowUpRight, Briefcase, Check, Loader2, User, X } from "lucide-react";
import { Icon } from "@/components/ui";
import { useState } from "react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import type { ChatMessage } from "@/lib/use-chat";
import type { Account, Direction, Purpose, TransactionInput } from "@/lib/types";
import { money, todayIso, dateShort } from "@/lib/format";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { categoryName } from "./category-name";
import { useChatT } from "./chat-t";

const DIRECTION_ICON = { in: ArrowDownLeft, out: ArrowUpRight, transfer: ArrowLeftRight } as const satisfies Record<Direction, typeof Check>;
const DIRECTION_KEY = { in: "biz.draft.in", out: "biz.draft.out", transfer: "biz.draft.transfer" } as const satisfies Record<Direction, string>;

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
  const { t, locale } = useI18n();
  const ct = useChatT();
  const draft = message.draft!;
  const state = message.draftState ?? "pending";
  const [purpose, setPurpose] = useState<Purpose>(draft.purpose && draft.purpose !== "unclear" ? draft.purpose : "business");
  const account = accounts.find((a) => a.id === draft.account_id);
  const isOut = draft.direction === "out";

  if (state === "dismissed") return null;

  const save = async () => {
    try {
      await onSave({ ...draft, date: draft.date ?? todayIso(), purpose });
      haptic("success");
      toast.success(t("biz.draft.toastSaved"));
    } catch {
      toast.error(ct("chatfix.draft.failed"));
    }
  };

  return (
    <div className="brush mt-3 rounded-2xl bg-butter p-3.5" role="group" aria-label={t("biz.draft.aria")}>
      {state !== "saved" ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-card">{ct("chatfix.draft.badge")}</span>
          <span className="text-xs text-ink/70">{ct("chatfix.draft.hint")}</span>
        </div>
      ) : null}
      <div className="flex items-baseline justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-sm text-ink/70"><Icon icon={DIRECTION_ICON[draft.direction]} size={16} />{t(DIRECTION_KEY[draft.direction])} · {dateShort(draft.date ?? todayIso(), locale)}</span>
        <span className="tabular text-xl font-semibold">
          {isOut ? "−" : draft.direction === "in" ? "+" : ""}
          {money(draft.amount, locale)}
        </span>
      </div>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        <dt className="text-ink/60">{t("biz.draft.category")}</dt>
        <dd>{categoryName(draft.category, locale)}</dd>
        <dt className="text-ink/60">{t("biz.draft.account")}</dt>
        <dd>{account?.name ?? `№${draft.account_id}`}</dd>
        {draft.counterparty ? (
          <>
            <dt className="text-ink/60">{t("biz.draft.counterparty")}</dt>
            <dd>{draft.counterparty}</dd>
          </>
        ) : null}
        {draft.note ? (
          <>
            <dt className="text-ink/60">{t("biz.draft.note")}</dt>
            <dd>{draft.note}</dd>
          </>
        ) : null}
      </dl>
      {draft.direction !== "transfer" ? (
        <div className="mt-3 inline-flex rounded-full bg-card/70 p-0.5" role="radiogroup" aria-label={t("biz.draft.purposeAria")}>
          {(["business", "personal"] as const).map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={purpose === p}
              disabled={state !== "pending"}
              onClick={() => setPurpose(p)}
              className={cn("min-h-11 rounded-full px-3.5 py-1.5 text-sm transition-colors", purpose === p ? "bg-ink text-card shadow-sm" : "text-ink/70")}
            >
              <Icon icon={p === "business" ? Briefcase : User} size={16} className="mr-1 inline" />
              {p === "business" ? t("biz.draft.business") : t("biz.draft.personal")}
            </button>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {state === "saved" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-2 text-sm font-medium">
            <Icon icon={Check} size={16} /> {t("biz.draft.saved")}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={save}
              disabled={state === "saving"}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-card shadow-[0_3px_0_0_rgb(0_0_0/0.35)] transition active:translate-y-0.5 active:shadow-none disabled:opacity-60"
            >
              {state === "saving" ? <Icon icon={Loader2} size={16} className="animate-spin" /> : <Icon icon={Check} size={16} />} {ct("chatfix.draft.confirm")}
            </button>
            <button type="button" onClick={onDismiss} disabled={state === "saving"} className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-full px-3 py-2 text-sm text-ink/70 active:scale-95">
              <Icon icon={X} size={16} /> {t("biz.draft.dismiss")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
