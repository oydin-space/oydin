"use client";

import { Area, CartesianGrid, ComposedChart, Line, ReferenceLine, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { formatMoney, type Currency } from "./money-format";
import { useKitLocale, useKitT } from "./kit-t";

export interface CashPoint {
  date: string;
  /** Факт (сплошная линия) — только для прошлого. */
  actual?: number;
  /** Прогноз (пунктир) — для будущего. */
  forecast?: number;
}

/**
 * Динамика денег: факт сплошной, прогноз пунктиром + подпись в таблице. Цвет не единственный канал:
 * пунктир отличает прогноз, ниже графика — таблица-альтернатива для скринридеров.
 */
export function CashChart({ points, currency = "UZS", label, todayLabel, height = 220, className }: { points: CashPoint[]; currency?: Currency; label: string; todayLabel?: string; height?: number; className?: string }) {
  const t = useKitT();
  const locale = useKitLocale();
  todayLabel ??= t("kit.chart.today");
  const lastActual = [...points].reverse().find((p) => p.actual != null)?.date;
  const fmt = (v: number) => formatMoney(v, { currency, locale, mode: "compact", withCurrency: false });
  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <div style={{ height }} role="img" aria-label={label}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis dataKey="date" tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} minTickGap={24} />
            <YAxis width={56} tickLine={false} axisLine={false} tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} tickFormatter={fmt} />
            <ReferenceLine y={0} stroke="var(--border-strong)" />
            {lastActual ? <ReferenceLine x={lastActual} stroke="var(--border-strong)" strokeDasharray="2 4" label={{ value: todayLabel, fill: "var(--muted-foreground)", fontSize: 12, position: "insideBottomRight" }} /> : null}
            <Area type="monotone" dataKey="actual" stroke="var(--foreground)" strokeWidth={2} fill="var(--mint)" fillOpacity={0.6} isAnimationActive={false} connectNulls />
            <Line type="monotone" dataKey="forecast" stroke="var(--foreground)" strokeWidth={2} strokeDasharray="6 5" dot={false} isAnimationActive={false} connectNulls />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      <figcaption className="sr-only">{label}</figcaption>
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {points.map((p) => (
            <tr key={p.date}>
              <th scope="row">{p.date}</th>
              <td>{p.actual != null ? formatMoney(p.actual, { currency, locale }) : formatMoney(p.forecast ?? null, { currency, locale })}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
