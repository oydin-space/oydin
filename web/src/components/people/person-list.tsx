"use client";

import { ListGroup, ListRow } from "@/components/ui";
import { useLocale, useT } from "@/i18n";
import type { Person } from "@/lib/people-api";
import { formatDecimal } from "./format";

function payText(p: Person, t: ReturnType<typeof useT>, locale: Parameters<typeof formatDecimal>[1]) {
  if (p.pay_amount == null) return t(`people.pay.${p.pay_type}`);
  const amount = p.pay_type === "percent" ? `${formatDecimal(p.pay_amount, locale)}%` : `${formatDecimal(p.pay_amount, locale)} ${p.currency}`;
  return `${amount} · ${t(`people.pay.${p.pay_type}`)}`;
}

export function PersonList({ people, onOpen }: { people: Person[]; onOpen: (p: Person) => void }) {
  const t = useT();
  const [locale] = useLocale();
  return (
    <ListGroup>
      {people.map((p) => (
        <ListRow key={p.id} title={p.name} trailing={<span className="text-small text-muted-foreground">{payText(p, t, locale)}</span>} chevron onClick={() => onOpen(p)} />
      ))}
    </ListGroup>
  );
}
