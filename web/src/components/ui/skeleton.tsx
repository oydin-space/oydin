import { cn } from "@/lib/utils";

/** Мягкий скелетон со светлым бликом; скрыт от скринридеров. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-control bg-[length:200%_100%] bg-[linear-gradient(110deg,var(--muted)_30%,var(--card)_50%,var(--muted)_70%)]",
        className,
      )}
      style={{ animation: "shimmer 2.2s linear infinite" }}
      {...props}
    />
  );
}

/** Несколько строк текста; последняя короче. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2", className)} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-4", i === lines - 1 && lines > 1 ? "w-2/3" : "w-full")} />
      ))}
    </div>
  );
}

/** Геометрия ListRow: иконка, две строки, сумма. */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div className={cn("flex min-h-row items-center gap-3 px-4", className)} aria-hidden="true">
      <Skeleton className="size-6 rounded-pill" />
      <div className="flex flex-1 flex-col gap-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-4 w-16" />
    </div>
  );
}

export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn("inset-group divide-y divide-border", className)} role="status" aria-busy="true" aria-label="Загрузка">
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonRow key={i} />
      ))}
    </div>
  );
}

/** Геометрия StatTile / MetricCard. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-col gap-2 rounded-card border border-border bg-card p-4", className)} aria-hidden="true">
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}

export function SkeletonChart({ className }: { className?: string }) {
  return <Skeleton className={cn("h-48 w-full rounded-card", className)} />;
}
