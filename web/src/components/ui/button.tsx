"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  "state-layer lip focus-ring motion-fast relative inline-flex min-target shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-2xl font-bold transition-colors aria-busy:pointer-events-none disabled:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-brand text-[#3b342a] [--lip:#c9a000] dark:[--lip:#9a7a00]",
        secondary: "border border-border bg-card text-foreground [--lip:var(--border-strong)]",
        ghost: "bg-transparent text-foreground shadow-none active:translate-y-0 [--lip:transparent]",
        destructive: "bg-danger text-danger-foreground [--lip:color-mix(in_srgb,var(--danger)_70%,black)]",
      },
      size: {
        sm: "px-3 text-small",
        md: "px-4 text-body",
        lg: "min-h-14 px-6 text-body",
      },
      block: { true: "w-full", false: "" },
    },
    defaultVariants: { variant: "primary", size: "md", block: false },
  },
);

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  icon?: LucideIcon;
  /** Занята: ширина не меняется, клики блокируются, скринридер слышит aria-busy. */
  loading?: boolean;
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, block, icon: Glyph, loading = false, asChild = false, disabled, className, children, type = "button", ...props },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size, block }), className);
  if (asChild) {
    return (
      <Slot.Root ref={ref} className={classes} {...props}>
        {children}
      </Slot.Root>
    );
  }
  return (
    <button ref={ref} type={type} className={classes} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      <span className={cn("inline-flex items-center justify-center gap-2", loading && "invisible")}>
        {Glyph ? <Glyph className="size-5" strokeWidth={1.75} aria-hidden="true" /> : null}
        {children}
      </span>
      {loading ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <Spinner variant="ring" size={20} />
        </span>
      ) : null}
    </button>
  );
});

const iconButtonVariants = cva(
  "state-layer focus-ring motion-fast inline-flex size-11 min-target shrink-0 items-center justify-center rounded-pill transition-colors disabled:pointer-events-none aria-pressed:bg-muted",
  {
    variants: {
      variant: {
        ghost: "press text-foreground disabled:opacity-50",
        secondary: "lip border border-border bg-card text-foreground [--lip:var(--border-strong)]",
        primary: "lip bg-brand text-[#3b342a] [--lip:#c9a000] dark:[--lip:#9a7a00]",
      },
    },
    defaultVariants: { variant: "ghost" },
  },
);

export interface IconButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "aria-label">,
    VariantProps<typeof iconButtonVariants> {
  icon: LucideIcon;
  /** Обязательное доступное имя: tooltip его дополняет, но не заменяет. */
  label: string;
  pressed?: boolean;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { icon: Glyph, label, pressed, variant, className, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      aria-pressed={pressed}
      className={cn(iconButtonVariants({ variant }), className)}
      {...props}
    >
      <Glyph className="size-5" strokeWidth={1.75} aria-hidden="true" />
    </button>
  );
});
