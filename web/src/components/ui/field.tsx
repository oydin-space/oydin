"use client";

import { forwardRef, useId } from "react";
import { cn } from "@/lib/utils";

export interface FieldChrome {
  label: string;
  hint?: string;
  /** Текст исправления: что именно поправить. */
  error?: string;
  required?: boolean;
  className?: string;
}

/** Постоянная подпись + подсказка + ошибка, связанные с контролем через id. */
export function FieldShell({
  id,
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldChrome & { id: string; children: React.ReactNode }) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <label htmlFor={id} className="text-small font-medium text-foreground">
        {label}
        {required ? (
          <span className="ml-0.5 text-danger" aria-hidden="true">
            *
          </span>
        ) : null}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-caption text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-caption text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export const controlClass =
  "focus-ring motion-fast min-h-12 w-full rounded-control border border-border-strong/40 bg-card px-3 text-body text-foreground transition-colors placeholder:text-muted-foreground disabled:opacity-50 aria-[invalid=true]:border-danger";

export const describedBy = (id: string, error?: string, hint?: string) =>
  error ? `${id}-error` : hint ? `${id}-hint` : undefined;

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">, FieldChrome {
  /** Слот справа внутри поля: единица, кнопка очистки. */
  trailing?: React.ReactNode;
  /** Слот слева внутри поля: иконка поиска. */
  leading?: React.ReactNode;
}

/** Текстовое поле. kind задаётся через type: text / search / date / email / tel. */
export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, className, trailing, leading, id: idProp, ...props },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <div className="relative flex items-center">
        {leading ? <span className="pointer-events-none absolute left-3 text-muted-foreground">{leading}</span> : null}
        <input
          ref={ref}
          id={id}
          required={required}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(controlClass, leading && "pl-10", trailing && "pr-14")}
          {...props}
        />
        {trailing ? <span className="absolute right-3 text-small text-muted-foreground">{trailing}</span> : null}
      </div>
    </FieldShell>
  );
});

export const Field = Input;

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement>, FieldChrome {}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { label, hint, error, required, className, id: idProp, rows = 3, ...props },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={cn(controlClass, "resize-y py-3")}
        {...props}
      />
    </FieldShell>
  );
});
