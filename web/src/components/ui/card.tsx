"use client";

import { useKitT } from "./kit-t";
import { cn } from "@/lib/utils";
import { PASTEL_BG, PASTEL_DEEP, type Pastel } from "@/lib/tone";
import { AmountText } from "./money";
import { NamedIcon, type IconName } from "./icon";
import { Sparkline } from "./sparkline";
import { Text } from "./text";
import type { Currency } from "./money-format";

export interface CardProps extends Omit<React.ComponentProps<"div">, "title"> {
  /** Пастельная заливка; без неё — плоская карточка на поверхности. */
  tint?: Pastel;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
}

/** Базовая карточка: radius 20, плоская рамка 1px, без тени. */
export function Card({ tint, title, description, footer, className, children, ...props }: CardProps) {
  return (
    <div className={cn("rounded-card p-4 text-foreground", tint ? cn("brush", PASTEL_BG[tint]) : "border border-border bg-card", className)} {...props}>
      {title || description ? (
        <div className="mb-3 flex flex-col gap-0.5">
          {title ? <h3 className="text-section font-semibold">{title}</h3> : null}
          {description ? <p className="text-small text-muted-foreground">{description}</p> : null}
        </div>
      ) : null}
      {children}
      {footer ? <div className="mt-3 border-t border-border pt-3">{footer}</div> : null}
    </div>
  );
}

export function PastelCard({ tone = "butter", ...props }: Omit<CardProps, "tint"> & { tone?: Pastel }) {
  return <Card tint={tone} {...props} />;
}

export function PlainCard(props: Omit<CardProps, "tint">) {
  return <Card {...props} />;
}

export interface StatTileProps {
  label: string;
  icon?: IconName;
  value: number | null;
  currency?: Currency;
  /** Изменение в тех же единицах (со знаком) и пояснение «к прошлой неделе». */
  delta?: number | null;
  deltaLabel?: string;
  trend?: number[];
  tint?: Pastel;
  className?: string;
}

export function StatTile({ label, icon, value, currency = "UZS", delta, deltaLabel, trend, tint = "mint", className }: StatTileProps) {
  return (
    <Card tint={tint} className={cn("flex flex-col gap-1", className)}>
      <Text variant="caption" tone="muted" className="inline-flex items-center gap-1.5">
        {icon ? <NamedIcon name={icon} size={16} /> : null}
        {label}
      </Text>
      <AmountText value={value} currency={currency} mode="compact" className="text-section font-semibold" />
      {delta != null ? (
        <p className="text-caption text-muted-foreground">
          <AmountText value={delta} currency={currency} mode="compact" signed /> {deltaLabel}
        </p>
      ) : null}
      {trend ? <Sparkline values={trend} color={PASTEL_DEEP[tint]} className="mt-1 w-full" /> : null}
    </Card>
  );
}

export interface MetricCardProps {
  label: string;
  value: number | null;
  currency?: Currency;
  period?: string;
  /** Одно предложение: из чего получилось число. */
  explanation?: string;
  source?: string;
  updatedAt?: string;
  onDetails?: () => void;
  detailsLabel?: string;
  missingReason?: string;
  tint?: Pastel;
  className?: string;
}

/** Главное число с происхождением: период, пояснение, источник, время обновления. */
export function MetricCard({ label, value, currency = "UZS", period, explanation, source, updatedAt, onDetails, detailsLabel, missingReason, tint, className }: MetricCardProps) {
  const t = useKitT();
  detailsLabel ??= t("kit.metric.details");
  return (
    <Card tint={tint} className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Text variant="secondary" tone="muted">{label}</Text>
        {period ? <Text variant="caption" tone="muted">{period}</Text> : null}
      </div>
      <AmountText value={value} currency={currency} missingReason={missingReason} className="text-hero font-bold" />
      {explanation ? <Text variant="secondary">{explanation}</Text> : null}
      {source || updatedAt ? (
        <Text variant="caption" tone="muted">
          {[source, updatedAt].filter(Boolean).join(" · ")}
        </Text>
      ) : null}
      {onDetails ? (
        <button type="button" onClick={onDetails} className="focus-ring min-target self-start rounded-control text-small font-medium underline underline-offset-4">
          {detailsLabel}
        </button>
      ) : null}
    </Card>
  );
}

export function PageTitle({ title, hint }: { title: string; hint?: string }) {
  return (
    <header className="mb-4 px-1 pt-1">
      <h1 className="text-page font-bold tracking-tight">{title}</h1>
      {hint ? <p className="mt-1 text-small text-muted-foreground">{hint}</p> : null}
    </header>
  );
}
