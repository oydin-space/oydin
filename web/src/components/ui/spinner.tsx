"use client";

import { useKitT } from "./kit-t";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/logo";
import { Flower } from "@/components/brand/flower";

export interface SpinnerProps {
  /** «logo» — вращающийся логотип для долгих задач; «flower» — неподвижная плитка бренда, цветок вращается (ответ ИИ); «ring» — компактное кольцо для кнопок. */
  variant?: "logo" | "ring" | "flower";
  size?: number;
  /** Текст задачи рядом со спиннером. Без него остаётся sr-only «Загрузка». */
  label?: string;
  className?: string;
}

/** Индикатор активной загрузки: логотип, лепестки которого плавно вращаются. */
export function Spinner({ variant = "logo", size = 40, label, className }: SpinnerProps) {
  const t = useKitT();
  if (variant === "ring") {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        className={cn("animate-flower", className)}
        style={{ animation: "flower-spin 0.9s linear infinite" }}
        fill="none"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
    );
  }
  if (variant === "flower") {
    return (
      <span className={cn("inline-flex items-center gap-2", className)} role="status" aria-live="polite">
        <span
          className="inline-flex shrink-0 items-center justify-center bg-brand text-white shadow-[0_6px_18px_-8px_#e0b400]"
          style={{ width: size, height: size, borderRadius: size * 0.3 }}
        >
          <span className="animate-flower inline-flex" style={{ animation: "flower-spin 1.6s linear infinite" }}>
            <Flower style={{ width: size * 0.62, height: size * 0.62 }} />
          </span>
        </span>
        {label ? <span className="text-small text-muted-foreground">{label}</span> : <span className="sr-only">{t("kit.loading")}</span>}
      </span>
    );
  }
  return (
    <span className={cn("inline-flex flex-col items-center gap-3", className)} role="status" aria-live="polite">
      <span className="animate-flower inline-flex" style={{ animation: "flower-spin 2.4s cubic-bezier(0.6,0,0.4,1) infinite" }}>
        <Logo size={size} />
      </span>
      {label ? <span className="text-small text-muted-foreground">{label}</span> : <span className="sr-only">{t("kit.loading")}</span>}
    </span>
  );
}
