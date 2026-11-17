"use client";

import { useState, type ComponentType } from "react";
import type { LucideProps } from "lucide-react";

export type CrayonName =
  | "pulse" | "calendar" | "operations" | "products" | "chat"
  | "voice" | "envelope" | "insight" | "gap" | "salary";

/** Восковая иконка из /brand/icons; если файла нет — запасная иконка lucide. */
export function CrayonIcon({
  name,
  fallback: Fallback,
  size = 40,
  className,
}: {
  name: CrayonName;
  fallback: ComponentType<LucideProps>;
  size?: number;
  className?: string;
}) {
  const [missing, setMissing] = useState(false);
  if (missing) return <Fallback size={size * 0.7} strokeWidth={1.6} className={className} aria-hidden="true" />;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={`/brand/icons/${name}.png`}
      alt=""
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, objectFit: "contain" }}
      onError={() => setMissing(true)}
    />
  );
}
