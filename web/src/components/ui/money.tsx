import { cn } from "@/lib/utils";
import { formatMoney, type Currency, type MoneyLocale, type MoneyMode } from "./money-format";

export interface AmountTextProps extends Omit<React.ComponentProps<"span">, "children"> {
  /** Минимальные единицы валюты; null = данных нет. */
  value: number | null | undefined;
  currency?: Currency;
  locale?: MoneyLocale;
  mode?: MoneyMode;
  /** Показывать «+» у положительных (для движений). Минус виден всегда. */
  signed?: boolean;
  /** Окрашивать знак; статус всегда дублируется символом + / −. */
  tone?: "auto" | "none";
  /** Почему суммы нет («нет данных за период»). */
  missingReason?: string;
}

/** Сумма: tabular-nums, знак символом, точная сумма в aria-label даже в компактном виде. */
export function AmountText({ value, currency = "UZS", locale = "ru", mode = "exact", signed, tone = "none", missingReason, className, ...props }: AmountTextProps) {
  if (value == null) {
    return (
      <span className={cn("tabular-nums text-muted-foreground", className)} aria-label={missingReason ?? "нет данных"} {...props}>
        —
      </span>
    );
  }
  const sign = signed ? "always" : "auto";
  const text = formatMoney(value, { currency, locale, mode, sign });
  const exact = mode === "compact" ? formatMoney(value, { currency, locale, mode: "exact", sign }) : undefined;
  return (
    <span
      className={cn("tabular-nums", tone === "auto" && value > 0 && "text-success", tone === "auto" && value < 0 && "text-danger", className)}
      aria-label={exact}
      {...props}
    >
      {text}
    </span>
  );
}

export const Money = AmountText;
