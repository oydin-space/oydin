"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Chart } from "@/lib/types";
import { soft, type FormatLocale } from "@/lib/format";
import { useI18n } from "@/i18n";

const COLORS = ["var(--butter-deep)", "var(--mint-deep)", "var(--sky-deep)", "var(--peach-deep)", "var(--rose-deep)"];

const isSum = (unit: string) => /сум|uzs/i.test(unit);

function formatValue(locale: FormatLocale, unit: string, v: number): string {
  return isSum(unit) ? `${soft(v, locale)}` : `${v.toLocaleString(locale === "uz" ? "uz-UZ" : locale === "en" ? "en-US" : "ru-RU", { maximumFractionDigits: 1 })}${unit ? `\u00a0${unit}` : ""}`;
}

const tooltip = {
  contentStyle: { borderRadius: 14, border: "1px solid var(--border)", background: "var(--card)", fontSize: 13 },
  cursor: { fill: "rgb(0 0 0 / 0.04)" },
};

/** Простой пастельный график ответа ИИ + таблица-альтернатива. */
export function AnswerChart({ chart }: { chart: Chart }) {
  const { t, locale } = useI18n();
  const fmt = formatValue.bind(null, locale);
  const { type, data, unit } = chart;
  const axis = { stroke: "var(--muted-foreground)", fontSize: 11, tickLine: false, axisLine: false } as const;
  return (
    <figure className="mt-3 rounded-2xl bg-card p-3">
      <figcaption className="mb-2 text-sm font-medium">{chart.title}</figcaption>
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          {type === "pie" ? (
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="label" innerRadius="48%" outerRadius="82%" paddingAngle={3} cornerRadius={6} stroke="none">
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip {...tooltip} formatter={(v) => fmt(unit, Number(v))} />
            </PieChart>
          ) : type === "bar" ? (
            <BarChart data={data} margin={{ left: -12, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} stroke="rgb(0 0 0 / 0.06)" />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} tickFormatter={(v) => fmt(unit, v)} width={56} />
              <Tooltip {...tooltip} formatter={(v) => fmt(unit, Number(v))} />
              <Bar dataKey="value" radius={[8, 8, 8, 8]} fill="var(--mint-deep)" />
            </BarChart>
          ) : type === "area" ? (
            <AreaChart data={data} margin={{ left: -12, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} stroke="rgb(0 0 0 / 0.06)" />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} tickFormatter={(v) => fmt(unit, v)} width={56} />
              <Tooltip {...tooltip} formatter={(v) => fmt(unit, Number(v))} />
              <Area type="monotone" dataKey="value" stroke="var(--sky-deep)" strokeWidth={2.5} fill="var(--sky-deep)" fillOpacity={0.25} />
            </AreaChart>
          ) : (
            <LineChart data={data} margin={{ left: -12, right: 4, top: 4 }}>
              <CartesianGrid vertical={false} stroke="rgb(0 0 0 / 0.06)" />
              <XAxis dataKey="label" {...axis} />
              <YAxis {...axis} tickFormatter={(v) => fmt(unit, v)} width={56} />
              <Tooltip {...tooltip} formatter={(v) => fmt(unit, Number(v))} />
              <Line type="monotone" dataKey="value" stroke="var(--sky-deep)" strokeWidth={2.5} dot={{ r: 3, strokeWidth: 0, fill: "var(--sky-deep)" }} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-xs text-ink/70">
        <summary className="cursor-pointer select-none">{t("biz.chart.asTable")}</summary>
        <table className="mt-1 w-full">
          <tbody>
            {data.map((d) => (
              <tr key={d.label}>
                <td className="py-0.5 pr-3">{d.label}</td>
                <td className="tabular py-0.5 text-right">{fmt(unit, d.value)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  );
}
