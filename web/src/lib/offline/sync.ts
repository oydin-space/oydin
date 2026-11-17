"use client";

import { useCallback, useSyncExternalStore } from "react";
import { post } from "@/lib/api";
import { idbStore } from "./idb-store";
import { createQueue, type FlushOutcome, type QueueEntry, type SyncResult, type SyncSender } from "./queue";

export interface OfflineState {
  ready: boolean;
  entries: QueueEntry[];
  lastSync: string | null;
  syncing: boolean;
  online: boolean;
  unauthorized: boolean;
}

const queue = createQueue(idbStore);
const send: SyncSender = async (items) => (await post<{ results: SyncResult[] }>("/sync/", { items })).results;

const EMPTY: OfflineState = { ready: false, entries: [], lastSync: null, syncing: false, online: true, unauthorized: false };
let state: OfflineState = EMPTY;
const listeners = new Set<() => void>();
const set = (patch: Partial<OfflineState>) => {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
};

async function refresh() {
  const [entries, lastSync] = await Promise.all([queue.list(), queue.lastSync()]);
  set({ ready: true, entries, lastSync });
}

let inflight: Promise<FlushOutcome> | null = null;
/** Один flush за раз; несколько подписчиков (бейдж, экран) не дублируют отправку. */
export function flush(opts: { retryFailed?: boolean } = {}): Promise<FlushOutcome> {
  inflight ??= (async () => {
    set({ syncing: true });
    try {
      const out = await queue.flush(send, opts);
      set({ unauthorized: out.status === "unauthorized" });
      return out;
    } finally {
      inflight = null;
      set({ syncing: false });
      await refresh().catch(() => undefined);
    }
  })();
  return inflight;
}

export async function enqueueOperation(payload: Parameters<typeof queue.enqueue>[1]): Promise<QueueEntry> {
  const entry = await queue.enqueue("operation", payload);
  await refresh();
  if (navigator.onLine) void flush();
  return entry;
}

export async function removeEntry(clientId: string) {
  await queue.remove(clientId);
  await refresh();
}

let subscribers = 0;
let teardown: (() => void) | null = null;

function start() {
  const onOnline = () => {
    set({ online: true });
    void flush();
  };
  const onOffline = () => set({ online: false });
  window.addEventListener("online", onOnline);
  window.addEventListener("offline", onOffline);
  set({ online: navigator.onLine });
  void refresh().then(() => {
    if (navigator.onLine) void flush();
  });
  return () => {
    window.removeEventListener("online", onOnline);
    window.removeEventListener("offline", onOffline);
  };
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (subscribers++ === 0) teardown = start();
  return () => {
    listeners.delete(cb);
    if (--subscribers === 0) {
      teardown?.();
      teardown = null;
    }
  };
}

/** Состояние очереди + автосинхронизация: при старте и событии online. */
export function useOfflineQueue() {
  const s = useSyncExternalStore(subscribe, () => state, () => EMPTY);
  const syncNow = useCallback(() => flush({ retryFailed: true }), []);
  return { ...s, pending: s.entries.length, syncNow };
}
