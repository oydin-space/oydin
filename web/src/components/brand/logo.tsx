import { cn } from "@/lib/utils";
import { Flower } from "./flower";

/** Белый цветок на скруглённом квадрате #FFD62C. */
export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center bg-brand text-white shadow-[0_6px_18px_-8px_#e0b400]", className)}
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
      role="img"
      aria-label="Oydin"
    >
      <Flower style={{ width: size * 0.62, height: size * 0.62 }} />
    </span>
  );
}

export function Wordmark({ size = 36, className }: { size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <Logo size={size} />
      <span className="text-xl font-semibold tracking-tight">Oydin</span>
    </span>
  );
}
