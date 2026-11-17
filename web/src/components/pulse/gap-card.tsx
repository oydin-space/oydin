import { CalendarClock, ShieldCheck } from "lucide-react";
import type { Pulse } from "@/lib/types";
import { dateLong, daysUntil, plural, softSum } from "@/lib/format";
import { CrayonIcon } from "@/components/brand/crayon-icon";
import { PastelCard } from "@/components/shared/pastel-card";

/** Ближайший кассовый разрыв. Мягко: «не хватит», а не «долг». */
export function GapCard({ gap, horizon = 30 }: { gap: Pulse["gap"]; horizon?: number }) {
  if (!gap) {
    return (
      <PastelCard tone="mint" className="flex items-center gap-4">
        <CrayonIcon name="gap" fallback={ShieldCheck} size={56} />
        <div>
          <p className="text-sm text-ink/70">Ближайший разрыв</p>
          <p className="font-semibold">Разрыва в ближайшие {horizon} дней не видно</p>
        </div>
      </PastelCard>
    );
  }
  const d = daysUntil(gap.date);
  return (
    <PastelCard tone="peach" className="flex items-start gap-4">
      <CrayonIcon name="gap" fallback={CalendarClock} size={56} />
      <div className="min-w-0">
        <p className="text-sm text-ink/70">Ближайший разрыв · {dateLong(gap.date)}</p>
        <p className="tabular text-2xl font-semibold leading-tight">не хватит {softSum(gap.amount)}</p>
        <p className="mt-1 text-sm text-ink/75">{gap.reason}</p>
        {d >= 0 ? (
          <p className="mt-1 text-xs text-ink/60">
            через {d} {plural(d, ["день", "дня", "дней"])}
          </p>
        ) : null}
      </div>
    </PastelCard>
  );
}
