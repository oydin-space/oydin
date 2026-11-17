"use client";

import { useKitT } from "./kit-t";
import { X } from "lucide-react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const badgeVariants = cva("inline-flex items-center gap-1 whitespace-nowrap rounded-pill px-2.5 py-0.5 text-caption font-medium", {
  variants: {
    tone: {
      neutral: "bg-muted text-foreground",
      positive: "bg-mint text-mint-ink",
      caution: "bg-butter text-butter-ink",
      negative: "bg-rose text-rose-ink",
      "coming-soon": "border border-dashed border-border-strong bg-transparent text-muted-foreground",
    },
  },
  defaultVariants: { tone: "neutral" },
});

/** Статус всегда текстом; цвет лишь усиливает. Опциональная иконка — для второго канала. */
export function Badge({ tone, icon, className, children, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants> & { icon?: React.ReactNode }) {
  return (
    <span className={cn(badgeVariants({ tone }), className)} {...props}>
      {icon}
      {children}
    </span>
  );
}

/** Чип: выбираемый (aria-pressed) и/или удаляемый. Высота 44px через min-target. */
export function Chip({
  selected,
  onSelect,
  onRemove,
  removeLabel,
  className,
  children,
  ...props
}: Omit<React.ComponentProps<"button">, "onSelect"> & { selected?: boolean; onSelect?: () => void; onRemove?: () => void; removeLabel?: string }) {
  const t = useKitT();
  removeLabel ??= t("kit.chip.remove");
  return (
    <span className={cn("inline-flex items-center rounded-pill border border-border-strong/40 bg-card", selected && "border-primary bg-primary text-primary-foreground", className)}>
      <button
        type="button"
        aria-pressed={onSelect ? !!selected : undefined}
        onClick={onSelect}
        className="focus-ring state-layer press min-target rounded-pill px-3.5 text-small font-medium"
        {...props}
      >
        {children}
      </button>
      {onRemove ? (
        <button type="button" aria-label={`${removeLabel}: ${typeof children === "string" ? children : ""}`} onClick={onRemove} className="focus-ring min-target -ml-2 grid place-items-center rounded-pill">
          <X className="size-4" aria-hidden="true" />
        </button>
      ) : null}
    </span>
  );
}
