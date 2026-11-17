import { cn } from "@/lib/utils";

/** Мягкий скелетон со светлым бликом. */
export function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "animate-shimmer rounded-xl bg-[length:200%_100%] bg-[linear-gradient(110deg,var(--muted)_30%,var(--card)_50%,var(--muted)_70%)]",
        className,
      )}
      style={{ animation: "shimmer 2.2s linear infinite" }}
      {...props}
    />
  );
}
