"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PastelCard, PlainCard } from "@/components/shared/pastel-card";
import { EmptyState, ErrorState, PageTitle } from "@/components/shared/states";
import { Skeleton } from "@/components/ui/skeleton";
import { dateShort, daysUntil, plural, soft, softSum, money } from "@/lib/format";
import type { Envelope, ForecastPoint, Obligation } from "@/lib/types";
import { useApi } from "@/lib/use-api";

const KIND: Record<Obligation["kind"], string> = { salary: "Зарплата", rent: "Аренда", tax: "Налог", supplier: "Поставщик", loan: "Кредит", other: "Прочее", receivable: "Нам должны" };

export function CalendarView() {
  const obligations = useApi<{ items: Obligation[] }>("/obligations/");
  const envelopes = useApi<{ items: Envelope[] }>("/envelopes/");
  const forecast = useApi<{ points: ForecastPoint[] }>("/forecast/?days=30");
  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-4">
      <PageTitle title="Календарь" hint="Обязательства, конверты и прогноз остатка на 30 дней" />
      <section aria-label="Прогноз остатка" className="space-y-2">
        <h2 className="px-1 text-sm font-medium text-muted-foreground">Прогноз остатка</h2>
        {forecast.error ? <ErrorState message={forecast.error} onRetry={forecast.reload} /> : !forecast.data ? <Skeleton className="h-52 rounded-2xl" /> : forecast.data.points.length ? (
          <PastelCard tone="sky" className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={forecast.data.points} margin={{ left: -8, right: 4, top: 4 }}>
                <CartesianGrid vertical={false} stroke="rgb(0 0 0 / 0.06)" />
                <XAxis dataKey="date" tickFormatter={dateShort} fontSize={11} tickLine={false} axisLine={false} minTickGap={32} />
                <YAxis tickFormatter={soft} fontSize={11} tickLine={false} axisLine={false} width={56} />
                <Tooltip labelFormatter={(l) => dateShort(String(l))} formatter={(v) => money(Number(v))} contentStyle={{ borderRadius: 14, border: "1px solid var(--border)" }} />
                <Area type="monotone" dataKey="balance" name="Остаток" stroke="var(--sky-deep)" strokeWidth={2.5} fill="var(--sky-deep)" fillOpacity={0.25} />
              </AreaChart>
            </ResponsiveContainer>
          </PastelCard>
        ) : <EmptyState title="Прогноза пока нет" />}
      </section>
      <section aria-label="Обязательства" className="space-y-2">
        <h2 className="px-1 text-sm font-medium text-muted-foreground">Ближайшие платежи</h2>
        {obligations.error ? <ErrorState message={obligations.error} onRetry={obligations.reload} /> : !obligations.data ? <Skeleton className="h-40 rounded-2xl" /> : obligations.data.items.length ? (
          <ul className="space-y-2">
            {obligations.data.items.map((o) => {
              const d = daysUntil(o.due_date);
              return (
                <li key={o.id}>
                  <PlainCard className="flex items-center gap-3 !p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{o.title}</p>
                      <p className="text-xs text-muted-foreground">{KIND[o.kind]} · {dateShort(o.due_date)}{o.status === "planned" && d >= 0 ? ` · через ${d} ${plural(d, ["день", "дня", "дней"])}` : ""}</p>
                    </div>
                    <span className="tabular text-sm font-semibold">{softSum(o.amount)}</span>
                    <span className={`rounded-full px-2.5 py-1 text-xs ${o.status === "paid" ? "bg-mint" : o.status === "overdue" ? "bg-peach" : o.covered ? "bg-mint" : "bg-butter"}`}>
                      {o.status === "paid" ? "Оплачено" : o.status === "overdue" ? "Просрочено" : o.covered ? "Покрыто" : "Не хватает"}
                    </span>
                  </PlainCard>
                </li>
              );
            })}
          </ul>
        ) : <EmptyState title="Обязательств нет" hint="Добавленные платежи появятся здесь" />}
      </section>
      <section aria-label="Конверты" className="space-y-2">
        <h2 className="px-1 text-sm font-medium text-muted-foreground">Конверты</h2>
        {envelopes.error ? <ErrorState message={envelopes.error} onRetry={envelopes.reload} /> : !envelopes.data ? <Skeleton className="h-32 rounded-2xl" /> : envelopes.data.items.length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {envelopes.data.items.map((e) => {
              const pct = e.target ? Math.min(100, Math.round((e.saved / e.target) * 100)) : 0;
              return (
                <PastelCard key={e.id} tone="mint" className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <h3 className="font-medium">{e.title}</h3>
                    <span className="text-xs text-ink/65">до {dateShort(e.due_date)}</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-white/70" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                    <div className="h-full rounded-full bg-mint-deep" style={{ width: `${pct}%` }} />
                  </div>
                  <p className="tabular text-sm">{softSum(e.saved)} из {softSum(e.target)} · откладывать по {softSum(e.daily)} в день</p>
                </PastelCard>
              );
            })}
          </div>
        ) : <EmptyState title="Конвертов нет" />}
      </section>
    </div>
  );
}
