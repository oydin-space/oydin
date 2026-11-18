"use client";

import { Check, Crown, Lock, Rocket, Sparkles, Sprout, Users, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Button, Card, Icon } from "@/components/ui";
import type { Pastel } from "@/lib/tone";
import { cn } from "@/lib/utils";
import { buyHref, billingText, priceLabel, type Plan, type PlanLocale } from "./plans-api";

const ICONS: Record<string, LucideIcon> = { sprout: Sprout, rocket: Rocket, users: Users, crown: Crown, sparkles: Sparkles };
const TINTS: Pastel[] = ["mint", "butter", "lavender", "peach", "sky"];

export const planTint = (index: number): Pastel => TINTS[index % TINTS.length];

function Section({ title, items, icon, tone }: { title: string; items: string[]; icon: LucideIcon; tone?: string }) {
  if (items.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-caption font-semibold uppercase tracking-wide text-foreground/80">{title}</h3>
      <ul className="flex flex-col gap-1.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-small">
            <Icon icon={icon} size={16} className={cn("mt-0.5", tone)} />
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export interface PlanCardProps {
  plan: Plan;
  locale: PlanLocale;
  tint: Pastel;
  /** Hide the CTA (e.g. when the card is a summary). */
  hideCta?: boolean;
  className?: string;
}

/** One pricing tier: name above price, 4:3 art, feature sections, CTA. Popular tier is larger. */
export function PlanCard({ plan, locale, tint, hideCta, className }: PlanCardProps) {
  const t = (key: Parameters<typeof billingText>[1]) => billingText(locale, key);
  const free = plan.price_uzs === 0;
  const [amount, period] = priceLabel(locale, plan).split(" / ");
  return (
    <Card
      tint={tint}
      className={cn(
        "relative flex h-full flex-col gap-4 p-5",
        plan.popular && "border-2 border-foreground/80 p-6 shadow-lg lg:py-10",
        className,
      )}
    >
      {plan.popular ? (
        <span className="absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-pill bg-brand px-3 py-1 text-caption font-semibold text-[#3b342a] shadow">
          <Icon icon={Crown} size={16} />
          {t("billing.popular")}
        </span>
      ) : null}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-title font-semibold">{plan.name}</h2>
          <p className={cn("mt-1 font-bold tracking-tight", "whitespace-nowrap", plan.popular ? "text-hero" : "text-section")}>
            {amount}
            {period ? <span className="text-small font-medium text-foreground/80"> / {period}</span> : null}
          </p>
          <p className="mt-1 text-small text-foreground/80">{plan.tagline}</p>
        </div>
        <Icon icon={ICONS[plan.icon] ?? Sparkles} size={24} />
      </header>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={plan.image} alt="" width={1200} height={900} loading="lazy" className="aspect-[4/3] w-full rounded-control bg-card object-cover" />
      <Section title={t("billing.section.new")} items={plan.new_features} icon={Sparkles} />
      <Section title={t("billing.section.missing")} items={plan.missing} icon={X} tone="text-foreground/80" />
      <Section title={t("billing.section.limits")} items={plan.limits} icon={Lock} tone="text-foreground/80" />
      <Section title={t("billing.section.included")} items={plan.features} icon={Check} />
      {hideCta ? null : (
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <Button asChild block variant={plan.popular ? "primary" : "secondary"}>
            <Link href={buyHref(plan)}>{free ? t("billing.ctaFree") : t("billing.ctaBuy")}</Link>
          </Button>
          {plan.cta_note ? <p className="text-center text-caption text-muted-foreground">{plan.cta_note}</p> : null}
        </div>
      )}
    </Card>
  );
}
