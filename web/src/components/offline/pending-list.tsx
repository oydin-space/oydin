"use client";

import { ArrowDownLeft, ArrowUpRight, Clock, RefreshCw, Trash2, TriangleAlert } from "lucide-react";
import { AmountText, Badge, Button, EmptyState, Icon, IconButton, ListGroup } from "@/components/ui";
import { useI18n } from "@/i18n";
import type { Account } from "@/lib/types";
import type { QueueEntry } from "@/lib/offline/queue";
import { CATEGORIES } from "@/lib/offline/reference";
import { accountLabel } from "@/lib/offline/labels";
import { useOfflineT } from "./use-offline-t";

export interface PendingListProps {
  entries: QueueEntry[];
  accounts: Account[];
  lastSync: string | null;
  syncing: boolean;
  online: boolean;
  onSync: () => void;
  onRemove: (clientId: string) => void;
}

export function PendingList({ entries, accounts, lastSync, syncing, online, onSync, onRemove }: PendingListProps) {
  const t = useOfflineT();
  const { locale, formatDate } = useI18n();
  const label = (direction: "in" | "out", category: string) => {
    const c = CATEGORIES[direction].find((x) => x.value === category);
    return c ? t(c.key) : category;
  };
  const time = (iso: string) => formatDate(iso, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  return (
    <section aria-label={t("offline.queue")} className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="min-w-0">
          <h2 className="text-body font-semibold">
            {t("offline.queue")}
            {entries.length ? <Badge className="ml-2" icon={<Icon icon={Clock} size={16} />}>{t("offline.pending", { count: entries.length })}</Badge> : null}
          </h2>
          <p className="truncate text-small text-muted-foreground">{lastSync ? t("offline.lastSync", { time: time(lastSync) }) : t("offline.never")}</p>
        </div>
        <Button size="sm" variant="secondary" icon={RefreshCw} loading={syncing} disabled={!online} onClick={onSync}>
          {t("offline.syncNow")}
        </Button>
      </div>

      {entries.length === 0 ? (
        <EmptyState title={t("offline.queueEmpty")} hint={t("offline.queueEmptyHint")} />
      ) : (
        <ListGroup>
          {entries.map((e) => (
            <li key={e.client_id} className="flex items-center gap-1 pr-2">
              <div className="flex min-h-row min-w-0 flex-1 items-center gap-3 px-4 py-2">
                <Icon icon={e.payload.direction === "in" ? ArrowDownLeft : ArrowUpRight} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-body">{label(e.payload.direction, e.payload.category)}</span>
                  <span className="truncate text-small text-muted-foreground">
                    {[(() => { const a = accounts.find((x) => x.id === e.payload.account_id); return a ? accountLabel(a.name, t) : undefined; })(), e.payload.note, time(e.created_at)].filter(Boolean).join(" · ")}
                  </span>
                  {e.error ? (
                    <span className="flex items-center gap-1 text-small text-danger">
                      <Icon icon={TriangleAlert} size={16} />
                      {t("offline.failed")}: {t(`offline.error.${e.error}`) === `offline.error.${e.error}` ? e.error : t(`offline.error.${e.error}`)}
                    </span>
                  ) : null}
                </span>
                <AmountText
                  className="shrink-0 text-body font-medium"
                  value={e.payload.direction === "in" ? e.payload.amount : -e.payload.amount}
                  currency={accounts.find((a) => a.id === e.payload.account_id)?.currency ?? "UZS"}
                  locale={locale}
                  signed
                  tone="auto"
                />
              </div>
              <IconButton icon={Trash2} label={t("offline.remove")} onClick={() => onRemove(e.client_id)} />
            </li>
          ))}
        </ListGroup>
      )}
    </section>
  );
}
