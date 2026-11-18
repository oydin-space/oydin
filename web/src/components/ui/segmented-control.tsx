"use client";

import { useId } from "react";
import { motion, useReducedMotion } from "motion/react";
import { cn } from "@/lib/utils";

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
}

export interface SegmentedControlProps<T extends string = string> {
  label: string;
  options: SegmentOption<T>[];
  value: T;
  onValueChange: (value: T) => void;
  className?: string;
}

/** ≤3 коротких варианта; больше — Select. Стрелки переключают, фокус по Tab. */
export function SegmentedControl<T extends string>({ label, options, value, onValueChange, className }: SegmentedControlProps<T>) {
  const group = useId();
  const reduce = useReducedMotion();
  const enabled = options.filter((o) => !o.disabled);
  const move = (dir: 1 | -1) => {
    const i = enabled.findIndex((o) => o.value === value);
    const next = enabled[(i + dir + enabled.length) % enabled.length];
    if (next) onValueChange(next.value);
  };
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex w-full rounded-control bg-muted p-1", className)}
      onKeyDown={(e) => {
        const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
        if (step) {
          e.preventDefault();
          move(step);
        }
      }}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            disabled={o.disabled}
            onClick={() => onValueChange(o.value)}
            className={cn(
              "focus-ring motion-fast relative min-h-11 min-w-11 flex-1 rounded-sm px-3 text-small font-medium transition-colors disabled:opacity-50",
              active ? "text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {active ? (
              <motion.span
                layoutId={`seg-${group}`}
                className="absolute inset-0 rounded-sm bg-primary shadow-soft ring-1 ring-border-strong"
                transition={reduce ? { duration: 0 } : { duration: 0.18, ease: [0.2, 0, 0, 1] }}
              />
            ) : null}
            <span className="relative">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}
