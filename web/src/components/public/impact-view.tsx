"use client";

import { useRouter } from "next/navigation";
import { Card, ErrorState, StatusBanner, Text } from "@/components/ui";
import { useI18n } from "@/i18n";
import { usePublicT } from "./use-public-t";
import type { Impact } from "@/lib/public-api";
import { PublicShell } from "./public-shell";
import { PublicTitle } from "./page-title";

const COUNTERS = [
  { field: "businesses", label: "public.impact.businesses", tint: "mint" },
  { field: "operations_recorded", label: "public.impact.operations", tint: "sky" },
  { field: "cash_closes", label: "public.impact.closes", tint: "butter" },
  { field: "gaps_flagged", label: "public.impact.gaps", tint: "lavender" },
] as const;

export function ImpactView({ impact }: { impact: Impact | null }) {
  const { formatNumber, formatDate } = useI18n();
  const t = usePublicT();
  const router = useRouter();
  return (
    <PublicShell>
      <PublicTitle title={t("public.impact.title")} hint={t("public.impact.desc")} />
      {impact === null ? (
        <ErrorState message={t("public.impact.error")} onRetry={() => router.refresh()} retryLabel={t("public.retry")} />
      ) : (
        <div className="flex flex-col gap-4">
          {impact.suppressed ? <StatusBanner kind="info" title={t("public.impact.notEnough")}>{t("public.impact.suppressed")}</StatusBanner> : null}
          <ul className="grid gap-3 sm:grid-cols-2">
            {COUNTERS.map(({ field, label, tint }) => {
              // 0 = скрыто бэкендом (k-анонимность), а не «ноль бизнесов».
              const value = impact.suppressed || impact[field] === 0 ? null : impact[field];
              return (
                <li key={field}>
                  <Card tint={tint} className="flex h-full flex-col gap-1">
                    <Text variant="secondary" tone="muted">{t(label)}</Text>
                    {value === null ? (
                      <Text variant="body" weight="medium">{t("public.impact.notEnough")}</Text>
                    ) : (
                      <Text variant="hero" weight="bold">{formatNumber(value)}</Text>
                    )}
                  </Card>
                </li>
              );
            })}
          </ul>
          <Text variant="caption" tone="muted">
            {t("public.impact.hint")} {t("public.impact.updated", { date: formatDate(impact.updated_at, { dateStyle: "medium", timeStyle: "short" }) })}
          </Text>
        </div>
      )}
      <Card title={t("public.impact.method.title")} className="mt-8">
        <ul className="flex list-disc flex-col gap-2 pl-5 text-small">
          {([1, 2, 3, 4] as const).map((n) => (
            <li key={n}>{t(`public.impact.method.${n}`)}</li>
          ))}
        </ul>
      </Card>
    </PublicShell>
  );
}
