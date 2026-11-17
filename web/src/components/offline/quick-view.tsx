"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { PageHeader, PlainCard, StatusBanner } from "@/components/ui";
import { api } from "@/lib/api";
import { loadAccounts, saveAccounts } from "@/lib/offline/reference";
import { currentScope } from "@/lib/offline/scope";
import { removeEntry, useOfflineQueue } from "@/lib/offline/sync";
import type { Account } from "@/lib/types";
import { PendingList } from "./pending-list";
import { QuickEntryForm } from "./quick-entry-form";
import { useOfflineT } from "./use-offline-t";

const noopSubscribe = () => () => undefined;

/** Экран быстрой записи: форма + очередь. Счета берутся из кэша, затем обновляются с сервера. */
export function QuickView() {
  const t = useOfflineT();
  const q = useOfflineQueue();
  const mounted = useSyncExternalStore(noopSubscribe, () => true, () => false);
  const businessId = mounted ? (currentScope()?.business_id ?? null) : null;
  const cached = useMemo(() => (businessId === null ? [] : loadAccounts(businessId)), [businessId]);
  const [fetched, setFetched] = useState<Account[] | null>(null);
  const accounts = fetched ?? cached;

  useEffect(() => {
    if (!navigator.onLine) return;
    api<{ items: Account[] }>("/accounts/")
      .then((r) => {
        if (businessId !== null) saveAccounts(businessId, r.items);
        setFetched(r.items);
      })
      .catch(() => undefined);
  }, [q.online, businessId]);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 pb-24">
      <PageHeader title={t("offline.title")} hint={t("offline.hint")} />
      {!q.online ? <StatusBanner kind="warning" title={t("offline.banner.offline")}>{t("offline.banner.offlineHint")}</StatusBanner> : null}
      {q.unauthorized ? <StatusBanner kind="info" title={t("offline.unauthorized")} /> : null}
      <PlainCard>
        <QuickEntryForm accounts={accounts} online={q.online} />
      </PlainCard>
      <PendingList
        entries={q.entries}
        accounts={accounts}
        lastSync={q.lastSync}
        syncing={q.syncing}
        online={q.online}
        onSync={() => void q.syncNow()}
        onRemove={(id) => void removeEntry(id)}
      />
    </div>
  );
}
