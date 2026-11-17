import { forwardRef } from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

export const textVariants = cva("", {
  variants: {
    variant: {
      caption: "text-caption",
      secondary: "text-small",
      body: "text-body",
      section: "text-title",
      page: "text-page tracking-tight",
      hero: "text-hero tracking-tight tabular-nums",
    },
    tone: {
      default: "text-foreground",
      muted: "text-muted-foreground",
      success: "text-success",
      warning: "text-warning",
      danger: "text-danger",
      inherit: "",
    },
    weight: { regular: "font-normal", medium: "font-medium", semibold: "font-semibold", bold: "font-bold" },
  },
  defaultVariants: { variant: "body", tone: "default", weight: "regular" },
});

type TextTag = "p" | "span" | "div" | "h1" | "h2" | "h3" | "h4" | "label" | "legend";

export interface TextProps extends Omit<React.HTMLAttributes<HTMLElement>, "color">, VariantProps<typeof textVariants> {
  as?: TextTag;
  htmlFor?: string;
}

/** Именованные стили текста: caption / secondary / body / section / page / hero. */
export const Text = forwardRef<HTMLElement, TextProps>(function Text(
  { as: Tag = "p", variant, tone, weight, className, ...props },
  ref,
) {
  const Comp = Tag as React.ElementType;
  return <Comp ref={ref} className={cn(textVariants({ variant, tone, weight }), className)} {...props} />;
});
