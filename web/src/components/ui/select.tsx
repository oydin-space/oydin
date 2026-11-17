"use client";

import { forwardRef, useId } from "react";
import { Select as S } from "radix-ui";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { FieldShell, controlClass, describedBy, type FieldChrome } from "./field";

export interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps extends FieldChrome {
  options: SelectOption[];
  value: string | undefined;
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
}

export const Select = forwardRef<HTMLButtonElement, SelectProps>(function Select(
  { options, value, onValueChange, placeholder, label, hint, error, required, disabled, className, id: idProp },
  ref,
) {
  const auto = useId();
  const id = idProp ?? auto;
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} required={required} className={className}>
      <S.Root value={value} onValueChange={onValueChange} disabled={disabled} required={required}>
        <S.Trigger
          ref={ref}
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, error, hint)}
          className={cn(controlClass, "flex items-center justify-between gap-2 text-left data-[placeholder]:text-muted-foreground")}
        >
          <S.Value placeholder={placeholder} />
          <S.Icon>
            <ChevronDown className="size-5 text-muted-foreground" aria-hidden="true" />
          </S.Icon>
        </S.Trigger>
        <S.Portal>
          <S.Content
            position="popper"
            sideOffset={6}
            className="z-[70] max-h-72 min-w-(--radix-select-trigger-width) overflow-hidden rounded-card border border-border bg-popover text-popover-foreground shadow-overlay data-[state=open]:animate-in data-[state=open]:fade-in-0"
          >
            <S.Viewport className="p-1">
              {options.map((o) => (
                <S.Item
                  key={o.value}
                  value={o.value}
                  disabled={o.disabled}
                  className="state-layer focus-ring relative flex min-h-11 cursor-default select-none items-center gap-2 rounded-control py-2 pl-3 pr-9 text-body outline-none data-[disabled]:opacity-50 data-[highlighted]:bg-muted"
                >
                  {o.icon}
                  <S.ItemText>{o.label}</S.ItemText>
                  <S.ItemIndicator className="absolute right-3">
                    <Check className="size-5" aria-hidden="true" />
                  </S.ItemIndicator>
                </S.Item>
              ))}
            </S.Viewport>
          </S.Content>
        </S.Portal>
      </S.Root>
    </FieldShell>
  );
});
