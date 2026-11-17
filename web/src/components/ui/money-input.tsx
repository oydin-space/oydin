"use client";

import { forwardRef, useEffect, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { FieldShell, controlClass, describedBy, type FieldChrome } from "./field";
import { currencyLabel, formatMoney, parseAmount, type Currency, type MoneyLocale } from "./money-format";

export interface MoneyInputProps extends FieldChrome {
  /** Целое в минимальных единицах валюты (сум / центы) или null. */
  value: number | null;
  onValueChange: (minor: number | null) => void;
  currency: Currency;
  locale?: MoneyLocale;
  disabled?: boolean;
  placeholder?: string;
  id?: string;
  name?: string;
}

const grouped = (minor: number, currency: Currency) => formatMoney(minor, { currency, withCurrency: false });

/**
 * Поле суммы: принимает «3 млн», «500к», «1 200 000», показывает дружелюбную подсказку
 * («≈ 3 млн сум»), валюта — постоянный суффикс. Десятичная клавиатура на мобильных.
 */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, currency, locale = "ru", label, hint, error, required, disabled, placeholder, className, id: idProp, name },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  const [text, setText] = useState(() => (value == null ? "" : grouped(value, currency)));

  // Внешнее изменение значения (сброс формы, смена валюты) синхронизирует текст.
  useEffect(() => {
    if (parseAmount(text, currency) !== value) setText(value == null ? "" : grouped(value, currency));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, currency]);

  const friendly = value != null && Math.abs(value) >= (currency === "USD" ? 100_000 : 1000) ? formatMoney(value, { currency, locale, mode: "compact" }) : null;
  const shownHint = friendly ? `≈ ${friendly}${hint ? ` · ${hint}` : ""}` : hint;

  return (
    <FieldShell id={id} label={label} hint={shownHint} error={error} required={required} className={className}>
      <div className="relative flex items-center">
        <input
          ref={ref}
          id={id}
          name={name}
          type="text"
          inputMode={currency === "USD" ? "decimal" : "numeric"}
          autoComplete="off"
          enterKeyHint="done"
          disabled={disabled}
          required={required}
          placeholder={placeholder ?? "0"}
          value={text}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, shownHint)}
          onChange={(e) => {
            setText(e.target.value);
            onValueChange(e.target.value.trim() === "" ? null : parseAmount(e.target.value, currency));
          }}
          onBlur={() => {
            const n = parseAmount(text, currency);
            if (n != null) setText(grouped(n, currency));
          }}
          className={cn(controlClass, "pr-16 text-right font-medium tabular-nums")}
        />
        <span className="pointer-events-none absolute right-3 text-small text-muted-foreground">{currencyLabel(currency, locale)}</span>
      </div>
    </FieldShell>
  );
});
