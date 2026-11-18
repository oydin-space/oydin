"use client";

import { Check, History, RotateCcw, Sparkles, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { Badge, Button, Card, EmptyState, ErrorState, ListGroup, ListRow, PAGE_WIDTH, PageHeader, SkeletonList, Switch, toast } from "@/components/ui";
import { useT } from "@/i18n";
import { ApiError } from "@/lib/api";
import { MODULE_KEYS, PRESET_KEYS, modulesApi, type ModuleKey, type ModulesResponse, type PresetKey, type Proposal, type WidgetKey, type WidgetVersion } from "./api";
import { SpecPreview } from "./spec-preview";

interface Data {
  mods: ModulesResponse;
  widgets: WidgetVersion[];
  proposals: Proposal[];
}

export function ModulesView() {
  const t = useT();
  const { user } = useSession();
  const [data, setData] = useState<Data | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<{ key: WidgetKey; versions: WidgetVersion[] } | null>(null);

  const load = useCallback(async () => {
    try {
      const [mods, widgets, proposals] = await Promise.all([modulesApi.get(), modulesApi.widgets(), modulesApi.proposals()]);
      setData({ mods, widgets, proposals });
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    if (user?.role !== "owner") return;
    const id = setTimeout(() => void load(), 0);
    return () => clearTimeout(id);
  }, [user?.role, load]);

  if (user && user.role !== "owner") return <EmptyState title={t("modules.forbidden.title")} hint={t("modules.forbidden.hint")} />;

  const run = async (fn: () => Promise<unknown>, done?: string) => {
    setBusy(true);
    try {
      await fn();
      if (done) toast.success(done);
      await load();
    } catch (e) {
      toast.error(e instanceof ApiError && e.message === "demo_tenant" ? t("modules.err.demo") : e instanceof ApiError && e.status === 409 ? t("modules.err.conflict") : t("modules.err.generic"));
    } finally {
      setBusy(false);
    }
  };
  const openHistory = (key: WidgetKey) => modulesApi.versions(key).then((versions) => setHistory({ key, versions })).catch(() => toast.error(t("modules.err.generic")));

  const pending = data?.proposals.filter((p) => p.status === "pending") ?? [];
  const decided = data?.proposals.filter((p) => p.status !== "pending").slice(0, 5) ?? [];
  const enabled = new Set(data?.mods.modules.filter((m) => m.enabled).map((m) => m.key));

  return (
    <div className={`${PAGE_WIDTH} flex flex-col gap-6`}>
      <PageHeader title={t("modules.title")} hint={t("modules.hint")} />
      {failed ? (
        <ErrorState message={t("modules.loadError")} onRetry={() => { setFailed(false); void load(); }} />
      ) : !data ? (
        <SkeletonList rows={5} />
      ) : (
        <>
          <section className="flex flex-col gap-2" aria-labelledby="mod-presets">
            <h2 id="mod-presets" className="text-section font-semibold">{t("modules.presets")}</h2>
            <p className="text-small text-muted-foreground">{t("modules.presets.hint")}</p>
            <div className="grid grid-cols-2 gap-2">
              {PRESET_KEYS.map((p: PresetKey) => {
                const set = data.mods.presets.find((x) => x.key === p)?.modules ?? [];
                const active = set.length === enabled.size && set.every((m) => enabled.has(m));
                return (
                  <Button key={p} variant={active ? "primary" : "secondary"} disabled={busy} aria-pressed={active} onClick={() => run(() => modulesApi.preset(p), t("modules.toast.preset"))}>
                    {t(`modules.preset.${p}`)}
                  </Button>
                );
              })}
            </div>
          </section>

          <ListGroup header={t("modules.list")} footer={t("modules.list.footer")}>
            {MODULE_KEYS.map((k: ModuleKey) => (
              <ListRow
                key={k}
                title={t(`modules.m.${k}`)}
                subtitle={t(`modules.m.${k}.hint`)}
                trailing={<Switch aria-label={t(`modules.m.${k}`)} checked={enabled.has(k)} disabled={busy || k === "money"} onCheckedChange={(v) => run(() => modulesApi.set({ [k]: v }))} />}
              />
            ))}
          </ListGroup>

          <section className="flex flex-col gap-3" aria-labelledby="mod-prop">
            <div className="flex items-center justify-between gap-3">
              <h2 id="mod-prop" className="text-section font-semibold">{t("modules.proposals")}</h2>
              <Button size="sm" variant="secondary" icon={Sparkles} disabled={busy} onClick={() => run(async () => {
                const made = await modulesApi.propose();
                toast.info(made.length ? t("modules.toast.found", { count: made.length }) : t("modules.toast.none"));
              })}>
                {t("modules.check")}
              </Button>
            </div>
            {pending.length === 0 ? (
              <EmptyState title={t("modules.proposals.empty")} hint={t("modules.proposals.emptyHint")} />
            ) : (
              pending.map((p) => {
                const cur = data.widgets.find((w) => w.key === p.key);
                return (
                  <Card key={p.id} title={t(`modules.w.${p.key}`)} description={p.rationale}>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="mb-1 text-caption font-medium uppercase text-muted-foreground">{t("modules.now")} · v{p.base_version}</p>
                        {cur ? <SpecPreview spec={cur.spec} /> : null}
                      </div>
                      <div>
                        <p className="mb-1 text-caption font-medium uppercase text-muted-foreground">{t("modules.after")}</p>
                        <SpecPreview spec={p.spec} changed={cur?.spec} />
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button variant="secondary" icon={X} disabled={busy} onClick={() => run(() => modulesApi.decide(p.id, "reject"))}>{t("modules.reject")}</Button>
                      <Button icon={Check} disabled={busy} onClick={() => run(() => modulesApi.decide(p.id, "approve"), t("modules.toast.approved"))}>{t("modules.approve")}</Button>
                    </div>
                  </Card>
                );
              })
            )}
            {decided.length ? (
              <ListGroup header={t("modules.decided")}>
                {decided.map((p) => (
                  <ListRow key={p.id} title={t(`modules.w.${p.key}`)} subtitle={p.rationale} status={<Badge tone={p.status === "approved" ? "positive" : "neutral"}>{t(`modules.status.${p.status}`)}</Badge>} />
                ))}
              </ListGroup>
            ) : null}
          </section>

          <ListGroup header={t("modules.widgets")} footer={t("modules.widgets.footer")}>
            {data.widgets.length === 0 ? <li className="p-4 text-small text-muted-foreground">{t("modules.widgets.empty")}</li> : null}
            {data.widgets.map((w) => (
              <ListRow key={w.key} title={t(`modules.w.${w.key}`)} subtitle={`v${w.version}`} onClick={() => openHistory(w.key)} leading={<History size={20} aria-hidden />} />
            ))}
          </ListGroup>

          {history ? (
            <Card title={`${t("modules.history")}: ${t(`modules.w.${history.key}`)}`}>
              <ul className="flex flex-col gap-3">
                {history.versions.map((v) => (
                  <li key={v.version} className="flex items-start justify-between gap-3 border-b border-border pb-3 last:border-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="mb-1 text-small font-bold">v{v.version} · {new Date(v.created_at).toLocaleDateString()} {v.active ? <Badge tone="positive">{t("modules.current")}</Badge> : null}</p>
                      <SpecPreview spec={v.spec} />
                    </div>
                    {v.active ? null : (
                      <Button size="sm" variant="secondary" icon={RotateCcw} disabled={busy} onClick={() => run(async () => { await modulesApi.rollback(history.key, v.version); setHistory(null); }, t("modules.toast.rolled"))}>
                        {t("modules.rollback")}
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <Button className="mt-3" variant="ghost" onClick={() => setHistory(null)}>{t("modules.close")}</Button>
            </Card>
          ) : null}
        </>
      )}
    </div>
  );
}
