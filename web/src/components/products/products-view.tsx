"use client";

import { PastelCard } from "@/components/shared/pastel-card";
import { EmptyState, ErrorState, PageTitle } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { money, pct } from "@/lib/format";
import type { Product } from "@/lib/types";
import { useApi } from "@/lib/use-api";

export function ProductsView() {
  const { data, error, reload } = useApi<{ items: Product[] }>("/products/");
  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-4">
      <PageTitle title="Товары" hint="Маржа и наценка по каждой позиции" />
      {error ? <ErrorState message={error} onRetry={reload} /> : !data ? (
        <div className="grid gap-3 sm:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}</div>
      ) : data.items.length ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.items.map((p) => (
            <PastelCard key={p.id} tone={p.margin_pct >= 30 ? "mint" : p.margin_pct >= 15 ? "butter" : "peach"} className="space-y-2">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold leading-snug">{p.name}</h3>
                {p.cost_is_estimate ? <span className="shrink-0 rounded-full bg-white/70 px-2 py-0.5 text-xs">допущение</span> : null}
              </div>
              <p className="tabular text-sm">Цена {money(p.price)} · себестоимость {money(p.unit_cost)}</p>
              <div className="h-2.5 overflow-hidden rounded-full bg-white/70" role="img" aria-label={`Маржа ${pct(p.margin_pct)}`}>
                <div className="h-full rounded-full bg-ink/40" style={{ width: `${Math.max(2, Math.min(100, p.margin_pct))}%` }} />
              </div>
              <p className="tabular text-sm text-ink/75">Маржа {pct(p.margin_pct)} · наценка {pct(p.markup_pct)}</p>
            </PastelCard>
          ))}
        </div>
      ) : <EmptyState title="Товаров пока нет" />}
    </div>
  );
}
