import { AlertTriangle, CheckCircle2, Info, RotateCcw } from "lucide-react";
import { Flower } from "@/components/brand/flower";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Card } from "./card";
import { SkeletonList } from "./skeleton";

export function ErrorState({ message, onRetry, retryLabel = "Повторить", className }: { message: string; onRetry?: () => void; retryLabel?: string; className?: string }) {
  return (
    <Card tint="rose" className={cn("flex items-center gap-3", className)} role="alert">
      <span className="flex-1 text-small">Не получилось загрузить: {message}</span>
      {onRetry ? (
        <Button size="sm" variant="secondary" icon={RotateCcw} onClick={onRetry}>
          {retryLabel}
        </Button>
      ) : null}
    </Card>
  );
}

export function EmptyState({ title, hint, action, className }: { title: string; hint?: string; action?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center gap-2 rounded-card border border-dashed border-border-strong/40 px-6 py-10 text-center", className)}>
      <Flower className="size-8 text-brand" />
      <p className="text-body font-medium">{title}</p>
      {hint ? <p className="max-w-xs text-small text-muted-foreground">{hint}</p> : null}
      {action}
    </div>
  );
}

export type StateViewProps = {
  status: "loading" | "error" | "empty" | "ready";
  error?: string;
  onRetry?: () => void;
  empty?: { title: string; hint?: string; action?: React.ReactNode };
  skeleton?: React.ReactNode;
  children: React.ReactNode;
};

/** Единый порядок состояний данных: загрузка → ошибка → пусто → готово. */
export function StateView({ status, error = "", onRetry, empty, skeleton, children }: StateViewProps) {
  if (status === "loading") return <>{skeleton ?? <SkeletonList />}</>;
  if (status === "error") return <ErrorState message={error} onRetry={onRetry} />;
  if (status === "empty") return <EmptyState title={empty?.title ?? "Пока пусто"} hint={empty?.hint} action={empty?.action} />;
  return <>{children}</>;
}

const BANNER = {
  info: { tint: "sky", icon: Info },
  success: { tint: "mint", icon: CheckCircle2 },
  warning: { tint: "butter", icon: AlertTriangle },
  error: { tint: "rose", icon: AlertTriangle },
} as const;

/** Баннер: иконка + текст, тон не единственный сигнал. */
export function StatusBanner({ kind = "info", title, children, action, className }: { kind?: keyof typeof BANNER; title: string; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const { tint, icon: I } = BANNER[kind];
  return (
    <Card tint={tint} role={kind === "error" ? "alert" : "status"} className={cn("flex items-start gap-3", className)}>
      <I className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
      <div className="flex-1">
        <p className="text-body font-medium">{title}</p>
        {children ? <p className="text-small">{children}</p> : null}
      </div>
      {action}
    </Card>
  );
}

/** Неблокирующая обратная связь рядом с действием («Сохранено в 14:32»). */
export function FeedbackNotice({ kind = "success", children }: { kind?: "success" | "error"; children: React.ReactNode }) {
  const Icon = kind === "success" ? CheckCircle2 : AlertTriangle;
  return (
    <p role={kind === "error" ? "alert" : "status"} className={cn("inline-flex items-center gap-1.5 text-small", kind === "success" ? "text-success" : "text-danger")}>
      <Icon className="size-4" aria-hidden="true" />
      {children}
    </p>
  );
}
