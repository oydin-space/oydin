"use client";

import { forwardRef, useId } from "react";
import { Checkbox as C, RadioGroup as R, Switch as Sw } from "radix-ui";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export const Switch = forwardRef<React.ComponentRef<typeof Sw.Root>, React.ComponentProps<typeof Sw.Root>>(function Switch(
  { className, ...props },
  ref,
) {
  return (
    <Sw.Root
      ref={ref}
      className={cn(
        "focus-ring motion-fast relative inline-flex h-8 w-14 shrink-0 items-center rounded-pill border border-border-strong/40 bg-muted p-0.5 transition-colors data-[state=checked]:border-transparent data-[state=checked]:bg-success disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <Sw.Thumb className="block size-6 rounded-pill bg-surface-raised shadow-soft transition-transform duration-(--dur-base) ease-enter data-[state=checked]:translate-x-6" />
    </Sw.Root>
  );
});

export const Checkbox = forwardRef<React.ComponentRef<typeof C.Root>, React.ComponentProps<typeof C.Root>>(function Checkbox(
  { className, ...props },
  ref,
) {
  return (
    <C.Root
      ref={ref}
      className={cn(
        "focus-ring motion-fast flex size-6 shrink-0 items-center justify-center rounded-sm border-2 border-border-strong bg-card transition-colors data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <C.Indicator>
        <Check className="size-4" strokeWidth={3} aria-hidden="true" />
      </C.Indicator>
    </C.Root>
  );
});

export const RadioGroup = R.Root;

export const RadioItem = forwardRef<React.ComponentRef<typeof R.Item>, React.ComponentProps<typeof R.Item>>(function RadioItem(
  { className, ...props },
  ref,
) {
  return (
    <R.Item
      ref={ref}
      className={cn(
        "focus-ring motion-fast flex size-6 shrink-0 items-center justify-center rounded-pill border-2 border-border-strong bg-card data-[state=checked]:border-primary disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <R.Indicator className="size-3 rounded-pill bg-primary" />
    </R.Item>
  );
});

export interface ChoiceControlProps {
  kind: "checkbox" | "switch" | "radio";
  label: string;
  description?: string;
  /** Для checkbox/switch. Для radio используйте value внутри RadioGroup. */
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  value?: string;
  disabled?: boolean;
  className?: string;
}

/** Строка с подписью (≥44 px, вся строка кликабельна). Switch — только для немедленных настроек, не для навигации. */
export function ChoiceControl({ kind, label, description, checked, onCheckedChange, value, disabled, className }: ChoiceControlProps) {
  const id = useId();
  const control =
    kind === "switch" ? (
      <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-describedby={description ? `${id}-d` : undefined} />
    ) : kind === "checkbox" ? (
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onCheckedChange?.(v === true)}
        disabled={disabled}
        aria-describedby={description ? `${id}-d` : undefined}
      />
    ) : (
      <RadioItem id={id} value={value ?? label} disabled={disabled} aria-describedby={description ? `${id}-d` : undefined} />
    );
  return (
    <div className={cn("flex min-h-11 items-center gap-3 py-1", kind === "switch" && "justify-between", className)}>
      {kind !== "switch" ? control : null}
      <label htmlFor={id} className="flex flex-1 flex-col py-1">
        <span className="text-body text-foreground">{label}</span>
        {description ? (
          <span id={`${id}-d`} className="text-small text-muted-foreground">
            {description}
          </span>
        ) : null}
      </label>
      {kind === "switch" ? control : null}
    </div>
  );
}
