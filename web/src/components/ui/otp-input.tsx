"use client";

import { forwardRef, useId, useState } from "react";
import { cn } from "@/lib/utils";
import { useKitT } from "./kit-t";

export interface OtpInputProps {
  value: string;
  onValueChange: (value: string) => void;
  /** Вызывается один раз, когда заполнены все ячейки (в том числе вставкой). */
  onComplete?: (value: string) => void;
  length?: number;
  label?: string;
  error?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

/**
 * Код из письма: одно настоящее поле поверх шести ячеек. Поддерживает вставку, автоподстановку
 * из SMS/почты (autocomplete=one-time-code) и Backspace без самодельной навигации по фокусу.
 */
export const OtpInput = forwardRef<HTMLInputElement, OtpInputProps>(function OtpInput(
  { value, onValueChange, onComplete, length = 6, label, error, disabled, autoFocus, className },
  ref,
) {
  const t = useKitT();
  const id = useId();
  const [focused, setFocused] = useState(false);
  const active = Math.min(value.length, length - 1);
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-small font-medium">
        {label ?? t("kit.otp.label")}
      </label>
      <div className="relative">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${length}, minmax(0, 1fr))` }} aria-hidden="true">
          {Array.from({ length }, (_, i) => (
            <div
              key={i}
              className={cn(
                "motion-fast flex h-14 items-center justify-center rounded-control border bg-card text-title font-semibold tabular-nums transition-colors",
                error ? "border-danger" : "border-border-strong/40",
                focused && i === active && !disabled && "border-primary outline-2 outline-offset-2 outline-ring",
                disabled && "opacity-50",
              )}
            >
              {value[i] ?? ""}
            </div>
          ))}
        </div>
        <input
          ref={ref}
          id={id}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={length}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-e` : undefined}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(e) => {
            const next = e.target.value.replace(/\D/g, "").slice(0, length);
            onValueChange(next);
            if (next.length === length) onComplete?.(next);
          }}
          className="absolute inset-0 size-full cursor-text opacity-0"
        />
      </div>
      {error ? (
        <p id={`${id}-e`} role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
});
