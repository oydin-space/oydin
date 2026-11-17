"use client";

import { Check } from "lucide-react";
import Link from "next/link";
import { Badge, Button, Card, Icon, Text } from "@/components/ui";
import { usePublicT } from "./use-public-t";
import { REQUEST_ACCESS_URL } from "@/lib/public-api";
import { PublicShell } from "./public-shell";
import { PublicTitle } from "./page-title";

const TIERS = [
  { id: "free", tint: "mint", points: 4, badge: "public.pricing.current", price: "public.pricing.freePrice", action: "start" },
  { id: "pro", tint: "butter", points: 3, badge: "public.pricing.coming", price: "public.pricing.byRequest", action: "request" },
  { id: "partner", tint: "lavender", points: 3, badge: null, price: "public.pricing.byRequest", action: "request" },
] as const;

export function PricingView() {
  const t = usePublicT();
  return (
    <PublicShell>
      <PublicTitle title={t("public.pricing.title")} hint={t("public.pricing.desc")} />
      <ul className="grid gap-4 md:grid-cols-3">
        {TIERS.map((tier) => (
          <li key={tier.id}>
            <Card tint={tier.tint} className="flex h-full flex-col gap-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-title font-semibold">{t(`public.pricing.${tier.id}`)}</h2>
                  {tier.badge ? <Badge tone={tier.id === "free" ? "positive" : "coming-soon"}>{t(tier.badge)}</Badge> : null}
                </div>
                <Text variant="secondary" tone="muted">{t(`public.pricing.${tier.id}Hint`)}</Text>
              </div>
              <div>
                <Text variant="caption" tone="muted">{t("public.pricing.priceLabel")}</Text>
                <Text variant="section" weight="bold">{t(tier.price)}</Text>
              </div>
              <ul className="flex flex-1 flex-col gap-2">
                {Array.from({ length: tier.points }, (_, i) => (
                  <li key={i} className="flex items-start gap-2 text-small">
                    <Icon icon={Check} size={16} className="mt-0.5" />
                    {t(`public.pricing.${tier.id}.${i + 1}`)}
                  </li>
                ))}
              </ul>
              {tier.action === "start" ? (
                <Button asChild block>
                  <Link href="/login">{t("public.pricing.start")}</Link>
                </Button>
              ) : (
                <Button asChild block variant="secondary">
                  <a href={REQUEST_ACCESS_URL} target="_blank" rel="noopener noreferrer">{t("public.pricing.request")}</a>
                </Button>
              )}
            </Card>
          </li>
        ))}
      </ul>
      <Text variant="caption" tone="muted" className="mt-4">{t("public.pricing.requestHint")}</Text>
    </PublicShell>
  );
}
