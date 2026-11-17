"use client";

import { Chip } from "./badge";
import { cn } from "@/lib/utils";

export interface FilterOption {
  value: string;
  label: string;
}

/** Горизонтальная лента чипов (один выбор). «Все» — первый вариант, сброс всегда виден. */
export function FilterBar({ options, value, onValueChange, label, className }: { options: FilterOption[]; value: string; onValueChange: (v: string) => void; label: string; className?: string }) {
  return (
    <div role="group" aria-label={label} className={cn("-mx-4 flex gap-2 overflow-x-auto px-4 pb-1", className)}>
      {options.map((o) => (
        <Chip key={o.value} selected={o.value === value} onSelect={() => onValueChange(o.value)} className="shrink-0">
          {o.label}
        </Chip>
      ))}
    </div>
  );
}
