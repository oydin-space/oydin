"use client";

import { ChevronDown, Code2, FileUp, Link2, RefreshCw, Unlink } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useSession } from "@/components/providers/session-provider";
import { Button, Dialog, FeedbackNotice, Icon, Input, LogoTile } from "@/components/ui";
import { useI18n } from "@/i18n";
import { catalog } from "@/i18n/parts/catalog";
import { api, ApiError, post } from "@/lib/api";
import { fetchTelegramLink } from "@/lib/settings-api";
import { ResourceGate } from "./resource-gate";
import { TelegramDialog } from "./telegram-dialog";
import { useResource } from "./use-resource";
import { useST } from "./use-st";

// Didox: вход по ИНН/ПИНФЛ и паролем, импорт подписанных счетов-фактур в черновики операций (connectors/views.py).
interface DidoxState {
  connected: boolean;
  configured: boolean;
  tax_id?: string;
  name?: string;
  last_sync_at?: string | null;
  last_error?: string;
}
const fetchDidox = () => api<DidoxState>("/connectors/didox/");

catalog.uz satisfies Record<keyof typeof catalog.ru, string>;
catalog.en satisfies Record<keyof typeof catalog.ru, string>;
type CKey = keyof typeof catalog.ru;

const DATA_PATH = "/app/settings/data";

type Mode = "working" | "setup" | "file";

interface Entry {
  id: string;
  logo: string;
  mode: Mode;
  onOpen?: () => void;
}

export function IntegrationsSection() {
  const { locale } = useI18n();
  const { user } = useSession();
  const telegram = useResource(fetchTelegramLink);
  const [tgOpen, setTgOpen] = useState(false);
  const [didoxOpen, setDidoxOpen] = useState(false);
  const owner = user?.role === "owner";
  const didox = useResource(fetchDidox, owner);
  const c = (key: CKey) => catalog[locale][key] ?? catalog.ru[key];

  const entries: Entry[] = [
    ...(owner ? [{ id: "didox", logo: "didox", mode: (didox.data?.connected ? "working" : "setup") as Mode, onOpen: () => setDidoxOpen(true) }] : []),
    { id: "banks", logo: "banks", mode: "file" },
    { id: "click", logo: "click", mode: "file" },
    { id: "payme", logo: "payme", mode: "file" },
    { id: "onec", logo: "1c", mode: "file" },
    { id: "sheets", logo: "google-sheets", mode: "file" },
    { id: "telegram", logo: "telegram", mode: telegram.data?.linked ? "working" : "setup", onOpen: () => setTgOpen(true) },
  ];

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <p className="text-small text-muted-foreground">{c("catalog.hint")}</p>

      <ul className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 [&>*]:min-w-0">
        {entries.map((e) => (
          <li key={e.id} className="flex flex-col gap-1">
            <LogoTile
              logo={e.logo}
              name={c(`catalog.${e.id}.name` as CKey)}
              description={c(`catalog.${e.id}.desc` as CKey)}
              status={e.mode === "working" ? "connected" : "available"}
              statusLabel={c(`catalog.status.${e.mode}` as CKey)}
              onClick={e.onOpen}
            />
            {e.mode !== "working" || e.id === "didox" ? (
              <Link href={DATA_PATH} className="inline-flex min-h-11 items-center gap-2 self-start rounded-control px-2 text-small font-medium underline underline-offset-4">
                <Icon icon={FileUp} size={16} />
                {c("catalog.file")}
              </Link>
            ) : null}
          </li>
        ))}
      </ul>

      {owner ? (
        <details className="group rounded-card border border-border bg-card">
          <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 p-3 [&::-webkit-details-marker]:hidden">
            <Icon icon={Code2} size={20} />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-body font-medium">{c("catalog.dev.title")}</span>
              <span className="text-small text-muted-foreground">{c("catalog.dev.hint")}</span>
            </span>
            <Icon icon={ChevronDown} size={20} className="transition-transform group-open:rotate-180" />
          </summary>
          <div className="flex flex-col items-start gap-3 border-t border-border p-3">
            <p className="text-small text-muted-foreground">{c("catalog.dev.body")}</p>
            <Link href="/app/settings/developer" className="inline-flex min-h-11 items-center gap-2 text-small font-medium underline underline-offset-4">
              {c("catalog.dev.open")}
            </Link>
          </div>
        </details>
      ) : null}

      <TelegramDialog open={tgOpen} onOpenChange={setTgOpen} state={telegram.data} loading={telegram.loading} error={telegram.error} reload={telegram.reload} />
      {owner ? <DidoxDialog open={didoxOpen} onOpenChange={setDidoxOpen} state={didox.data} loading={didox.loading} error={didox.error} reload={didox.reload} /> : null}
    </div>
  );
}

function DidoxDialog({
  open,
  onOpenChange,
  state,
  loading,
  error,
  reload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: DidoxState | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
}) {
  const { t, err, formatDate } = useST();
  const [taxId, setTaxId] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setProblem(null);
    setDone(null);
    try {
      await action();
    } catch (x) {
      setProblem(err(x));
    } finally {
      setBusy(false);
    }
  }

  const validTaxId = /^(\d{9}|\d{14})$/.test(taxId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("settings.didox.title")} description={t("settings.didox.desc")} closeLabel={t("settings.common.close")}>
      <ResourceGate loading={loading} error={error} onRetry={reload}>
        <div className="flex flex-col gap-3">
          {state && !state.configured ? <FeedbackNotice>{t("settings.didox.notConfigured")}</FeedbackNotice> : null}
          {state?.connected ? (
            <>
              <p className="text-small">
                {state.name || t("settings.integrations.didox")} · {state.tax_id}
              </p>
              <p className="text-small text-muted-foreground">
                {state.last_sync_at ? t("settings.didox.lastSync", { date: formatDate(state.last_sync_at) }) : t("settings.didox.never")}
              </p>
              {state.last_error ? <FeedbackNotice>{err(new ApiError(400, `didox_${state.last_error}`))}</FeedbackNotice> : null}
              <Button
                icon={RefreshCw}
                loading={busy}
                onClick={() =>
                  run(async () => {
                    const r = await post<{ ok: boolean; error: string; created: number }>("/connectors/didox/sync/");
                    reload();
                    if (!r.ok) throw new ApiError(400, r.error);
                    setDone(t("settings.didox.synced", { count: r.created }));
                  })
                }
              >
                {t("settings.didox.sync")}
              </Button>
              <Button
                variant="destructive"
                icon={Unlink}
                loading={busy}
                onClick={() =>
                  run(async () => {
                    await api("/connectors/didox/", { method: "DELETE" });
                    reload();
                  })
                }
              >
                {t("settings.didox.disconnect")}
              </Button>
            </>
          ) : (
            <form
              className="flex flex-col gap-3"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await api("/connectors/didox/", { method: "PUT", body: JSON.stringify({ tax_id: taxId, password }) });
                  setPassword("");
                  reload();
                });
              }}
            >
              <Input
                label={t("settings.didox.taxId")}
                hint={t("settings.didox.taxIdHint")}
                inputMode="numeric"
                autoComplete="username"
                maxLength={14}
                value={taxId}
                onChange={(e) => setTaxId(e.target.value.replace(/\D/g, ""))}
              />
              <Input label={t("settings.didox.password")} hint={t("settings.didox.passwordHint")} type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <Button type="submit" icon={Link2} loading={busy} disabled={!validTaxId || !password || !state?.configured}>
                {t("settings.didox.connect")}
              </Button>
            </form>
          )}
          {done ? <FeedbackNotice>{done}</FeedbackNotice> : null}
          {problem ? <p className="text-small text-destructive">{problem}</p> : null}
        </div>
      </ResourceGate>
    </Dialog>
  );
}
