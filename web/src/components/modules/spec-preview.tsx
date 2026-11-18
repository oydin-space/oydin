import type { MetricKey, WidgetSpec } from "./api";
import { useT } from "@/i18n";

/** Описание виджета словами: без выдуманных цифр, только настройки спецификации. */
export function SpecPreview({ spec, changed }: { spec: WidgetSpec; changed?: Partial<WidgetSpec> }) {
  const t = useT();
  const rows: [string, string | undefined, boolean][] = [
    [t("modules.spec.type"), t(`modules.spec.type.${spec.type}`), changed ? changed.type !== spec.type : false],
    [t("modules.spec.metric"), t(`modules.metric.${`${spec.source}.${spec.metric}` as MetricKey}`), changed ? changed.metric !== spec.metric : false],
    [t("modules.spec.size"), spec.size ? t(`modules.spec.size.${spec.size}`) : undefined, changed ? changed.size !== spec.size : false],
    [t("modules.spec.period"), spec.period, changed ? changed.period !== spec.period : false],
    [t("modules.spec.limit"), spec.limit ? String(spec.limit) : undefined, changed ? changed.limit !== spec.limit : false],
  ];
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-small">
      {rows.filter(([, v]) => v).map(([k, v, diff]) => (
        <div key={k} className="contents">
          <dt className="text-muted-foreground">{k}</dt>
          <dd className={diff ? "font-bold" : ""}>{v}</dd>
        </div>
      ))}
    </dl>
  );
}
