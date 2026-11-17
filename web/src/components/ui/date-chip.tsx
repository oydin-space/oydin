import { CalendarDays } from "lucide-react";
import { cn } from "@/lib/utils";

/** Дата в виде «пилюли»: подпись и ISO в <time>, чтобы скринридер читал дату целиком. */
export function DateChip({ date, label, locale = "ru-RU", className }: { date: string; label?: string; locale?: string; className?: string }) {
  const d = new Date(date);
  const text = Number.isNaN(d.getTime()) ? date : d.toLocaleDateString(locale, { day: "numeric", month: "short" });
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-pill bg-muted px-3 py-1 text-caption font-medium", className)}>
      <CalendarDays className="size-4" aria-hidden="true" />
      {label ? <span className="text-muted-foreground">{label}</span> : null}
      <time dateTime={date}>{text}</time>
    </span>
  );
}
