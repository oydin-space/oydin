"use client";

import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Spinner } from "./spinner";

export const buttonVariants = cva(
  "state-layer press focus-ring motion-fast relative inline-flex min-target shrink-0 select-none items-center justify-center gap-2 whitespace-nowrap rounded-control font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 aria-busy:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-foreground",
        secondary: "border border-border bg-secondary text-foreground",
        ghost: "bg-transparent text-foreground",
        destructive: "bg-danger text-danger-foreground",
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
  "state-layer press focus-ring motion-fast inline-flex size-11 min-target shrink-0 items-center justify-center rounded-pill transition-colors disabled:pointer-events-none disabled:opacity-50 aria-pressed:bg-muted",
  {
    variants: {
      variant: {
        ghost: "text-foreground",
        secondary: "border border-border bg-secondary text-foreground",
        primary: "bg-primary text-primary-foreground",
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
