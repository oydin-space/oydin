import { RotateCcw } from "lucide-react";
import { Flower } from "@/components/brand/flower";
import { PlainCard } from "./pastel-card";

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <PlainCard className="flex items-center gap-3 bg-rose/50" role="alert">
      <span className="flex-1 text-sm">Не получилось загрузить: {message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1.5 rounded-full bg-card px-3 py-1.5 text-sm font-medium shadow-sm active:scale-95">
          <RotateCcw size={14} /> Повторить
        </button>
      ) : null}
    </PlainCard>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-6 py-10 text-center">
      <Flower className="size-8 text-brand" />
      <p className="font-medium">{title}</p>
      {hint ? <p className="max-w-xs text-sm text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function PageTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <header className="mb-4 px-1 pt-1">
      <h1 className="text-[2rem] font-bold leading-tight tracking-tight">{title}</h1>
      {hint ? <p className="mt-1 text-sm text-muted-foreground">{hint}</p> : null}
    </header>
  );
}
