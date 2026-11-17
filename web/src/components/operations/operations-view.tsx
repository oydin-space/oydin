"use client";

import { Search } from "lucide-react";
import { useEffect, useState } from "react";
import { PlainCard } from "@/components/shared/pastel-card";
import { EmptyState, ErrorState, PageTitle } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { dateShort, money } from "@/lib/format";
import { PURPOSE_LABEL } from "@/lib/tone";
import type { Purpose, Transaction } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { cn } from "@/lib/utils";

const FILTERS: { value: Purpose | ""; label: string }[] = [
  { value: "", label: "Все" },
  { value: "business", label: "Целевые" },
  { value: "personal", label: "Нецелевые" },
  { value: "unclear", label: "Не ясно" },
];

export function OperationsView() {
  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  const [purpose, setPurpose] = useState<Purpose | "">("");
  useEffect(() => {
    const t = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);
  const params = new URLSearchParams({ limit: "100" });
  if (debounced) params.set("q", debounced);
  if (purpose) params.set("purpose", purpose);
  const { data, error, loading, reload } = useApi<{ items: Transaction[] }>(`/transactions/?${params}`);

  return (
    <div className="mx-auto max-w-3xl space-y-4 pb-4">
      <PageTitle title="Операции" hint="Последние движения денег" />
      <label className="relative block">
        <span className="sr-only">Поиск по операциям</span>
        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Поиск: заметка, контрагент, категория" className="w-full rounded-full border border-border bg-card py-2.5 pl-10 pr-4 text-sm outline-none focus-visible:ring-2 focus-visible:ring-lavender-deep" />
      </label>
      <div className="no-scrollbar flex gap-2 overflow-x-auto" role="radiogroup" aria-label="Фильтр по типу">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" role="radio" aria-checked={purpose === f.value} onClick={() => setPurpose(f.value)} className={cn("shrink-0 rounded-full px-4 py-1.5 text-sm", purpose === f.value ? "bg-ink text-card" : "bg-muted")}>
            {f.label}
          </button>
        ))}
      </div>
      {error ? <ErrorState message={error} onRetry={reload} /> : loading && !data ? (
        <div className="space-y-2">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}</div>
      ) : data && data.items.length ? (
        <ul className="space-y-2">
          {data.items.map((t) => (
            <li key={t.id}>
              <PlainCard className="flex items-center gap-3 !p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{t.category}{t.counterparty ? ` · ${t.counterparty}` : ""}</p>
                  <p className="truncate text-xs text-muted-foreground">{dateShort(t.date)} · {PURPOSE_LABEL[t.purpose]}{t.status === "draft" ? " · черновик" : ""}{t.note ? ` · ${t.note}` : ""}</p>
                </div>
                <span className={cn("tabular whitespace-nowrap font-semibold", t.direction === "in" && "text-mint-deep")}>
                  {t.direction === "in" ? "+" : t.direction === "out" ? "−" : ""}{money(t.amount)}
                </span>
              </PlainCard>
            </li>
          ))}
        </ul>
      ) : <EmptyState title="Операций не найдено" hint="Надиктуйте трату в чате на главной — она появится здесь" />}
    </div>
  );
}
