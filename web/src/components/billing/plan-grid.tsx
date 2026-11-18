"use client";

import { useEffect, useState } from "react";
import { ErrorState, SkeletonCard } from "@/components/ui";
import { api } from "@/lib/api";
import { PlanCard, planTint } from "./plan-card";
import { appPlanHref, billingText } from "./plans-api";
import { usePlans } from "./use-plans";

/** Public pages have no session provider, so a logged-in visitor is detected with a plain /auth/me/ probe. */
function useLoggedIn(enabled: boolean) {
  const [loggedIn, setLoggedIn] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    api("/auth/me/").then(
      () => !cancelled && setLoggedIn(true),
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [enabled]);
  return loggedIn;
}

/**
 * Mobile: vertical stack, popular plan first. ≥1024px: one row in admin order, popular enlarged.
 * `app` mode (or a logged-in visitor on a public page) points CTAs at /app/billing instead of /login.
 */
export function PlanGrid({ mode = "public", currentCode }: { mode?: "public" | "app"; currentCode?: string }) {
  const { locale, state, retry } = usePlans();
  const loggedIn = useLoggedIn(mode === "public");
  const inApp = mode === "app" || loggedIn;
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
          <PlanCard plan={plan} locale={locale} tint={planTint(i)} href={inApp ? appPlanHref(plan) : undefined} current={inApp && plan.code === currentCode} />
        </li>
      ))}
    </ul>
  );
}
