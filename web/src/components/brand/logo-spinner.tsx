import { cn } from "@/lib/utils";
import { Logo } from "./logo";

/** Индикатор загрузки: логотип, лепестки которого плавно вращаются. */
export function LogoSpinner({ size = 40, label, className }: { size?: number; label?: string; className?: string }) {
  return (
    <span className={cn("inline-flex flex-col items-center gap-3", className)} role="status" aria-live="polite">
      <span className="animate-flower inline-flex" style={{ animation: "flower-spin 2.4s cubic-bezier(0.6,0,0.4,1) infinite" }}>
        <Logo size={size} />
      </span>
      {label ? <span className="text-sm text-muted-foreground">{label}</span> : <span className="sr-only">Загрузка</span>}
    </span>
  );
}
