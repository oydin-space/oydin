"use client";

import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";
import { useKitT } from "./kit-t";

interface Parts {
  d: string;
  m: string;
  y: string;
}

const split = (iso: string): Parts => {
  const [y = "", m = "", d = ""] = iso.split("-");
  return { d, m, y };
};

const join = ({ d, m, y }: Parts): string => {
  if (y.length !== 4 || !m || !d) return "";
  const iso = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso ? "" : iso;
};

export interface DateFieldProps {
  id: string;
  value: string;
  onValueChange: (iso: string) => void;
  min?: string;
  max?: string;
  disabled?: boolean;
  invalid?: boolean;
  className?: string;
  describedBy?: string;
}

/**
 * Дата: три сегмента (день, месяц, год) и кнопка календаря. Подписи идут из i18n,
 * а не из браузера, поэтому на узбекском и русском интерфейсе не появляется «Day / Month / Year».
 * Системный календарь открывается через скрытый input[type=date].
 */
export function DateField({ id, value, onValueChange, min, max, disabled, invalid, describedBy, className }: DateFieldProps) {
  const t = useKitT();
  const nativeRef = useRef<HTMLInputElement>(null);
  const [parts, setParts] = useState<Parts>(() => split(value));
  const [seen, setSeen] = useState(value);

  // Внешнее значение (сброс формы, выбор в календаре) пересобирает сегменты; частичный ввод не трогаем.
  if (value !== seen) {
    setSeen(value);
    if (join(parts) !== value) setParts(split(value));
  }

  const update = (key: keyof Parts, raw: string, max: number) => {
    const digits = raw.replace(/\D/g, "").slice(0, max);
    const next = { ...parts, [key]: digits };
    setParts(next);
    const iso = join(next);
    if (iso) {
      setSeen(iso);
      onValueChange(iso);
    } else if (!next.d && !next.m && !next.y) {
      setSeen("");
      onValueChange("");
    }
  };

  const segment = "w-full bg-transparent text-center outline-none tabular-nums placeholder:text-muted-foreground";
  const common = { type: "text", inputMode: "numeric" as const, autoComplete: "off", disabled, "aria-invalid": invalid || undefined };
  return (
    <div
      role="group"
      aria-label={t("kit.date.group")}
      className={cn(className, "relative flex items-center gap-1 pr-1 focus-within:ring-2 focus-within:ring-ring")}
      aria-invalid={invalid || undefined}
    >
      <input {...common} id={id} aria-label={t("kit.date.day")} aria-describedby={describedBy} placeholder={t("kit.date.dd")} value={parts.d} onChange={(e) => update("d", e.target.value, 2)} className={cn(segment, "w-9")} />
      <span aria-hidden="true" className="text-muted-foreground">.</span>
      <input {...common} aria-label={t("kit.date.month")} placeholder={t("kit.date.mm")} value={parts.m} onChange={(e) => update("m", e.target.value, 2)} className={cn(segment, "w-9")} />
      <span aria-hidden="true" className="text-muted-foreground">.</span>
      <input {...common} aria-label={t("kit.date.year")} placeholder={t("kit.date.yyyy")} value={parts.y} onChange={(e) => update("y", e.target.value, 4)} className={cn(segment, "w-14")} />
      <span className="flex-1" />
      <button
        type="button"
        disabled={disabled}
        aria-label={t("kit.date.show")}
        onClick={() => nativeRef.current?.showPicker?.()}
        className="focus-ring state-layer min-target grid place-items-center rounded-pill text-muted-foreground"
      >
        <CalendarDays className="size-5" aria-hidden="true" />
      </button>
      <input
        ref={nativeRef}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        value={value}
        min={min}
        max={max}
        onChange={(e) => e.target.value && onValueChange(e.target.value)}
        className="pointer-events-none absolute right-0 bottom-0 size-px opacity-0"
      />
    </div>
  );
}
