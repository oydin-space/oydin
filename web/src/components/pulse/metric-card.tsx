import type { Metric } from "@/lib/types";
import { metricValue } from "@/lib/format";
import { PASTEL_DEEP, TONE_PASTEL, type Pastel } from "@/lib/tone";
import { PastelCard } from "@/components/shared/pastel-card";
import { Sparkline } from "@/components/shared/sparkline";

// Каждой карточке — свой пастельный цвет по порядку, тревога выражается только подсказкой.
const ORDER: Pastel[] = ["sky", "lavender", "butter", "mint"];

export function MetricCard({ metric, index }: { metric: Metric; index: number }) {
  const pastel = metric.tone === "risk" ? TONE_PASTEL.risk : ORDER[index % ORDER.length];
  return (
    <PastelCard tone={pastel} className="flex min-h-32 w-full flex-col justify-between gap-2">
      <div>
        <p className="text-sm text-ink/70">{metric.label}</p>
        <p className="tabular mt-1 text-xl font-semibold leading-tight sm:text-2xl">{metricValue(metric.unit, metric.value)}</p>
      </div>
      {metric.trend && metric.trend.length > 1 ? <Sparkline values={metric.trend} color={PASTEL_DEEP[pastel]} className="w-full" /> : null}
      <p className="text-xs text-ink/65">{metric.hint}</p>
    </PastelCard>
  );
}
