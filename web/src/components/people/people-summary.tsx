"use client";

import { Card, Text } from "@/components/ui";
import { useLocale, useT } from "@/i18n";
import type { PeopleSummary as Summary } from "@/lib/people-api";
import { formatDecimal } from "./format";

function Stat({ label, value, tint }: { label: string; value: string; tint?: "mint" | "butter" | "sky" | "rose" }) {
  return (
    <Card tint={tint} className="flex flex-col gap-1">
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <span className="text-section font-semibold tabular-nums">{value}</span>
    </Card>
  );
}

export function PeopleSummary({ summary }: { summary: Summary }) {
  const t = useT();
  const [locale] = useLocale();
  const headcount = Object.values(summary.headcount_by_kind).reduce<number>((a, b) => a + (b ?? 0), 0);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <Stat label={t("people.summary.headcount")} value={String(headcount)} tint="mint" />
      <Stat label={t("people.summary.cost")} value={`${formatDecimal(summary.monthly_cost_uzs, locale)} UZS`} tint="butter" />
      <Stat label={t("people.summary.joined")} value={`+${summary.turnover_month.joined}`} />
      <Stat label={t("people.summary.left")} value={`−${summary.turnover_month.left}`} />
    </div>
  );
}
