"use client";

import { ExternalLink } from "lucide-react";
import { Card, SegmentedControl, StatusBanner } from "@/components/ui";
import { useT } from "@/i18n";
import type { Regime, Registration } from "./beginner-api";

export function RegistrationSection({ reg, regime, onRegime }: { reg: Registration; regime: Regime; onRegime: (r: Regime) => void }) {
  const t = useT();
  const rows: [keyof Registration["columns"], keyof Registration["forms"][number]][] = [
    ["who", "who"],
    ["liability", "liability"],
    ["staff", "staff"],
    ["where", "where"],
  ];
  return (
    <Card title={t("beginner.reg.title")} description={t("beginner.reg.hint")}>
      <div className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {reg.forms.map((f) => (
            <section key={f.id} className={`flex flex-col gap-3 rounded-control border p-3 ${regime === f.id ? "border-brand bg-brand/10" : "border-border"}`}>
              <h4 className="text-body font-semibold">{f.name}</h4>
              <dl className="flex flex-col gap-2">
                {rows.map(([col, key]) => (
                  <div key={col}>
                    <dt className="text-caption text-muted-foreground">{reg.columns[col]}</dt>
                    <dd className="text-small">{f[key]}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-small font-medium">{t("beginner.reg.choose")}</span>
          <SegmentedControl
            label={t("beginner.reg.choose")}
            value={regime}
            onValueChange={onRegime}
            options={[
              { value: "self_employed", label: t("beginner.reg.selfEmployed") },
              { value: "yatt", label: t("beginner.reg.yatt") },
              { value: "mchj", label: t("beginner.reg.mchj") },
            ]}
          />
          {regime === "" ? <p className="text-caption text-muted-foreground">{t("beginner.reg.none")}</p> : null}
        </div>
        <StatusBanner kind="warning" title={reg.disclaimer} />
        <div>
          <p className="text-small font-medium">{reg.sources_title}</p>
          <ul className="mt-1 flex flex-wrap gap-2">
            {reg.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noopener noreferrer" className="focus-ring inline-flex min-h-11 items-center gap-1.5 rounded-pill border border-border px-4 text-small font-medium">
                  {s.label}
                  <ExternalLink className="size-4" aria-hidden="true" />
                  <span className="sr-only">{t("beginner.reg.open")}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Card>
  );
}
