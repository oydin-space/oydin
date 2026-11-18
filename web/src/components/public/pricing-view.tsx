"use client";

import { PlanGrid } from "@/components/billing/plan-grid";
import { PublicShell } from "./public-shell";
import { PublicTitle } from "./page-title";
import { useT } from "@/i18n";

export function PricingView() {
  const t = useT();
  return (
    <PublicShell>
      <PublicTitle title={t("billing.title")} hint={t("billing.subtitle")} />
      <PlanGrid />
    </PublicShell>
  );
}
