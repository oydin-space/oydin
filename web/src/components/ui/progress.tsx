import { cn } from "@/lib/utils";
import { AmountText } from "./money";
import type { Currency } from "./money-format";

const clamp = (n: number) => Math.max(0, Math.min(1, n));

export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  const v = clamp(value);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className={cn("h-2 w-full overflow-hidden rounded-pill bg-muted", className)}>
      <div className="h-full rounded-pill bg-foreground transition-[width] duration-(--dur-sheet) ease-enter" style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function ProgressRing({ value, label, size = 56, children }: { value: number; label: string; size?: number; children?: React.ReactNode }) {
  const v = clamp(value);
  const r = 22;
  const c = 2 * Math.PI * r;
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(v * 100)} className="relative inline-grid place-items-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 52 52" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="5" className="stroke-muted" />
        <circle cx="26" cy="26" r={r} fill="none" strokeWidth="5" strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - v)} className="stroke-foreground" />
      </svg>
      <span className="relative text-caption font-semibold tabular-nums">{children ?? `${Math.round(v * 100)}%`}</span>
    </div>
  );
}

/** «Резерв на налоги»: набрано из цели; суммы всегда числами, не только полоской. */
export function EnvelopeProgress({ label, saved, target, currency = "UZS" }: { label: string; saved: number; target: number; currency?: Currency }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 text-small">
        <span className="font-medium">{label}</span>
        <span className="text-muted-foreground">
          <AmountText value={saved} currency={currency} mode="compact" /> / <AmountText value={target} currency={currency} mode="compact" />
        </span>
      </div>
      <ProgressBar value={target > 0 ? saved / target : 0} label={label} />
    </div>
  );
}
