"use client";

import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Icon } from "@/components/ui";
import { useT } from "@/i18n";
import type { PersonDraft } from "@/lib/people-api";

/** Черновик человека от ИИ: в базу попадает только после клика «Подтвердить» (обычный POST /api/people/). */
export function PersonDraftCard({
  draft,
  state,
  onConfirm,
  onDismiss,
}: {
  draft: PersonDraft;
  state: "pending" | "saving" | "saved" | "dismissed";
  onConfirm: () => Promise<void>;
  onDismiss: () => void;
}) {
  const t = useT();
  if (state === "dismissed") return null;
  const confirm = async () => {
    try {
      await onConfirm();
      toast.success(t("people.toast.saved"));
    } catch {
      toast.error(t("people.draft.failed"));
    }
  };
  const pay = draft.pay_type && draft.pay_type !== "none" ? `${draft.pay_amount ?? "—"} ${draft.currency ?? "UZS"} · ${t(`people.pay.${draft.pay_type}`)}` : t("people.pay.none");
  return (
    <div className="brush mt-3 rounded-2xl bg-butter p-3.5" role="group" aria-label={t("people.draft.aria")}>
      {state !== "saved" ? (
        <div className="mb-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-card">{t("people.draft.badge")}</span>
          <span className="text-xs text-ink/70">{t("people.draft.hint")}</span>
        </div>
      ) : null}
      <p className="text-lg font-semibold">{draft.name}</p>
      <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-sm">
        <dt className="text-ink/60">{t("people.field.kind")}</dt>
        <dd>{t(`people.kindOne.${draft.kind ?? "staff"}`)}</dd>
        <dt className="text-ink/60">{t("people.field.payType")}</dt>
        <dd className="tabular">{pay}</dd>
      </dl>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {state === "saved" ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3.5 py-2 text-sm font-medium">
            <Icon icon={Check} size={16} /> {t("people.draft.saved")}
          </span>
        ) : (
          <>
            <button
              type="button"
              onClick={confirm}
              disabled={state === "saving"}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-ink px-5 py-2 text-sm font-semibold text-card shadow-[0_3px_0_0_rgb(0_0_0/0.35)] transition active:translate-y-0.5 active:shadow-none disabled:opacity-60"
            >
              <Icon icon={state === "saving" ? Loader2 : Check} size={16} className={state === "saving" ? "animate-spin" : undefined} /> {t("people.draft.confirm")}
            </button>
            <button type="button" onClick={onDismiss} disabled={state === "saving"} className="inline-flex min-h-11 items-center gap-1 whitespace-nowrap rounded-full px-3 py-2 text-sm text-ink/70 active:scale-95">
              <Icon icon={X} size={16} /> {t("people.cancel")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
