import { CalendarDays } from "lucide-react";
import { formatDate, type Locale } from "@/i18n/core";
import { cn } from "@/lib/utils";

/** Дата в виде «пилюли»: подпись и ISO в <time>, чтобы скринридер читал дату целиком. */
export function DateChip({ date, label, locale = "ru", className }: { date: string; label?: string; locale?: Locale; className?: string }) {
  const d = new Date(date);
  const text = Number.isNaN(d.getTime()) ? date : formatDate(d, locale, { day: "numeric", month: "short" });
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-pill bg-muted px-3 py-1 text-caption font-medium", className)}>
      <CalendarDays className="size-4" aria-hidden="true" />
      {label ? <span className="text-muted-foreground">{label}</span> : null}
      <time dateTime={date}>{text}</time>
    </span>
  );
}
