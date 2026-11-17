"use client";
import { useState } from "react";

export type FaqItem = { q: string; a: string };

export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="ld-faq">
      {items.map((it, i) => (
        <div key={it.q} className={`ld-faq-i ${open === i ? "is-open" : ""}`}>
          <button type="button" aria-expanded={open === i} onClick={() => setOpen(open === i ? null : i)}>
            <span>{it.q}</span>
            <span aria-hidden>{open === i ? "−" : "+"}</span>
          </button>
          {open === i && <p>{it.a}</p>}
        </div>
      ))}
    </div>
  );
}
