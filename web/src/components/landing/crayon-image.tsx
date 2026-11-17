"use client";
import { useState } from "react";

export function CrayonImage({ src, className, fallback }: { src: string; className?: string; fallback: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return <span className={`ld-emoji ${className ?? ""}`} aria-hidden>{fallback}</span>;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className={className} onError={() => setOk(false)} loading="lazy" />;
}
