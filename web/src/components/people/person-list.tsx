"use client";

import { ListGroup, ListRow, Text } from "@/components/ui";
import { useLocale, useT } from "@/i18n";
import { KINDS, type PeopleLocation, type Person } from "@/lib/people-api";
import { formatDecimal } from "./format";

function payText(p: Person, t: ReturnType<typeof useT>, locale: Parameters<typeof formatDecimal>[1]) {
  if (p.pay_type === "none" || p.pay_amount == null) return t(`people.pay.${p.pay_type}`);
  const amount = p.pay_type === "percent" ? `${formatDecimal(p.pay_amount, locale)}%` : `${formatDecimal(p.pay_amount, locale)} ${p.currency}`;
  return `${amount} · ${t(`people.pay.${p.pay_type}`)}`;
}

/** People grouped by kind; empty groups are not rendered. */
export function PersonList({ people, locations, onOpen }: { people: Person[]; locations: PeopleLocation[]; onOpen: (p: Person) => void }) {
  const t = useT();
  const [locale] = useLocale();
  const place = new Map(locations.map((l) => [l.id, l.name]));
  return (
    <div className="flex flex-col gap-5">
      {KINDS.map((kind) => {
        const items = people.filter((p) => p.kind === kind);
        if (items.length === 0) return null;
        return (
          <section key={kind} aria-label={t(`people.kind.${kind}`)} className="flex flex-col gap-2">
            <Text as="h2" variant="section" weight="semibold">
              {t(`people.kind.${kind}`)} · {items.length}
            </Text>
            <ListGroup>
              {items.map((p) => (
                <ListRow
                  key={p.id}
                  title={p.name}
                  subtitle={[p.role_title, p.location_id != null ? place.get(p.location_id) : null].filter(Boolean).join(" · ") || undefined}
                  trailing={<span className="text-small text-muted-foreground">{payText(p, t, locale)}</span>}
                  chevron
                  onClick={() => onOpen(p)}
                />
              ))}
            </ListGroup>
          </section>
        );
      })}
    </div>
  );
}
