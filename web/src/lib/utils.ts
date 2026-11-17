import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Our type-scale tokens (--text-*) are font sizes; without this tailwind-merge
// treats `text-body` as a colour and drops `text-primary-foreground` next to it.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { "font-size": [{ text: ["caption", "small", "body", "title", "page", "hero"] }] } },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
