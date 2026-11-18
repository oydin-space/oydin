"use client";

import { ErrorState, SkeletonCard } from "@/components/ui";
import { PlanCard, planTint } from "./plan-card";
import { billingText } from "./plans-api";
import { usePlans } from "./use-plans";

/** Mobile: vertical stack, popular plan first. ≥1024px: one row in admin order, popular enlarged. */
export function PlanGrid() {
  const { locale, state, retry } = usePlans();
  if (state.status === "loading") {
    return (
      <div className="grid gap-4 lg:grid-cols-3" aria-busy="true">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    );
  }
  if (state.status === "error") {
    return <ErrorState message={billingText(locale, "billing.loadError")} onRetry={retry} retryLabel={billingText(locale, "billing.retry")} />;
  }
  return (
    <ul className="flex flex-col gap-8 pt-3 lg:grid lg:auto-cols-fr lg:grid-flow-col lg:items-center lg:gap-6">
      {state.plans.map((plan, i) => (
        <li key={plan.code} className={plan.popular ? "order-first lg:order-none" : undefined}>
          <PlanCard plan={plan} locale={locale} tint={planTint(i)} />
        </li>
      ))}
    </ul>
  );
}
