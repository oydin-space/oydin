"use client";

import { Avatar as A } from "radix-ui";
import { cn } from "@/lib/utils";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");

export function Avatar({ name, src, size = 40, className }: { name: string; src?: string; size?: 32 | 40 | 56; className?: string }) {
  return (
    <A.Root
      className={cn("inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-pill bg-lavender font-semibold text-lavender-ink", className)}
      style={{ width: size, height: size, fontSize: size / 2.6 }}
    >
      {src ? <A.Image src={src} alt={name} className="size-full object-cover" /> : null}
      <A.Fallback aria-label={name}>{initials(name) || "?"}</A.Fallback>
    </A.Root>
  );
}
