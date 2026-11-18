"use client";

import { CreditCard, ExternalLink, Info, MessageCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Badge, Button, Card, ErrorState, PAGE_WIDTH, PageHeader, SkeletonCard, StatusBanner } from "@/components/ui";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api";
import { PlanCard, planTint } from "./plan-card";
import { checkout, fetchSubscription, TELEGRAM_URL, type Subscription } from "./plans-api";
import { usePlans } from "./use-plans";

type PayState = "idle" | "paying" | "unavailable" | "forbidden" | "error";

export function BillingView() {
  const t = useT();
  const code = useSearchParams().get("plan");
  const { locale, state, retry } = usePlans();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [pay, setPay] = useState<PayState>("idle");

  const alertRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (pay === "unavailable") alertRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [pay]);

  useEffect(() => {
    fetchSubscription().then(setSub, () => setSub(null));
  }, []);

  const plans = state.status === "ready" ? state.plans : [];
  const index = plans.findIndex((p) => p.code === code);
  const plan = index >= 0 ? plans[index] : null;
  const free = plan !== null && plan.price_uzs === 0;
  const current = sub ? plans.find((p) => p.code === sub.plan) : undefined;

  async function startPayment() {
    if (!plan) return;
    setPay("paying");
    try {
      const res = await checkout(plan.code);
      if (res.available) window.location.assign(res.url);
      else setPay("unavailable");
    } catch (e) {
      setPay(e instanceof ApiError && e.status === 403 ? "forbidden" : "error");
    }
  }

  return (
    <div className={`${PAGE_WIDTH} flex flex-col gap-4`}>
      <PageHeader title={t("billing.page.title")} hint={t("billing.page.hint")} />
      {sub ? (
        <Card className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-caption text-muted-foreground">{t("billing.current")}</p>
            <p className="text-section font-semibold">{current?.name ?? sub.plan}</p>
            {sub.renews_at ? <p className="text-small text-muted-foreground">{t("billing.renews", { date: new Date(sub.renews_at).toLocaleDateString(locale) })}</p> : null}
          </div>
          <Badge tone={sub.status === "active" ? "positive" : sub.status === "pending" ? "caution" : "neutral"}>{t(`billing.status.${sub.status}`)}</Badge>
        </Card>
      ) : null}

      {state.status === "loading" ? <SkeletonCard /> : null}
      {state.status === "error" ? <ErrorState message={t("billing.loadError")} onRetry={retry} retryLabel={t("billing.retry")} /> : null}

      {state.status === "ready" && !plan ? (
        <StatusBanner kind="info" title={t("billing.pick")} action={<Button asChild variant="secondary" icon={ExternalLink}><Link href="/pricing">{t("billing.back")}</Link></Button>} />
      ) : null}

      {plan ? (
        <>
          <h2 className="text-section font-semibold">{t("billing.summary")}</h2>
          <PlanCard plan={plan} locale={locale} tint={planTint(index)} hideCta className="md:max-w-md lg:[&_img]:!aspect-[16/6]" />
          {pay === "unavailable" ? (
            <div ref={alertRef} role="alert">
            <StatusBanner
              kind="warning"
              title={t("billing.unavailable.title")}
              action={
                <Button asChild variant="secondary" icon={MessageCircle}>
                  <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer">{t("billing.writeUs")}</a>
                </Button>
              }
            >
              {t("billing.unavailable.text")}
            </StatusBanner>
            </div>
          ) : null}
          {free ? (
            <StatusBanner kind="info" title={t("billing.freePlan")} />
          ) : (
            <Button block size="lg" icon={CreditCard} loading={pay === "paying"} onClick={startPayment}>
              {pay === "paying" ? t("billing.paying") : t("billing.pay")}
            </Button>
          )}
          {pay === "forbidden" ? <StatusBanner kind="warning" title={t("billing.ownerOnly")} /> : null}
          {pay === "error" ? <StatusBanner kind="error" title={t("billing.payError")} /> : null}
          <Button asChild variant="ghost" block icon={Info}>
            <Link href="/pricing">{t("billing.choose")}</Link>
          </Button>
        </>
      ) : null}
    </div>
  );
}
