import type { Scope } from "./scope";

// Офлайн-очередь записей. Чистая логика: хранилище и транспорт подставляются снаружи (IndexedDB / fetch / память в тестах).

export type QueueKind = "operation";

export interface OperationPayload {
  amount: number;
  direction: "in" | "out";
  category: string;
  account_id: number;
  note?: string;
  date?: string;
}

export interface QueueEntry {
  client_id: string;
  /** Владелец и бизнес на момент записи; запись без штампа (legacy) удаляется при первой загрузке. */
  user_id: number;
  business_id: number;
  kind: QueueKind;
  payload: OperationPayload;
  created_at: string;
  /** Код отказа сервера; запись с ошибкой не уходит автоматически, пока её не повторят вручную. */
  error?: string | null;
}

export interface QueueStore {
  all(): Promise<QueueEntry[]>;
  put(entry: QueueEntry): Promise<void>;
  remove(clientId: string): Promise<void>;
  getMeta(key: string): Promise<string | null>;
  setMeta(key: string, value: string): Promise<void>;
}

export interface SyncResult {
  client_id: string;
  status: "created" | "duplicate" | "error";
  id: number | null;
  error: string | null;
}

/** Транспорт: POST /api/sync/ с {business_id, items}. Бросает {status} при HTTP-ошибке, любое другое исключение = нет сети. */
export type SyncSender = (items: Pick<QueueEntry, "client_id" | "kind" | "payload">[], businessId: number) => Promise<SyncResult[]>;

export type FlushStatus = "idle" | "ok" | "partial" | "offline" | "unauthorized" | "failed";

export interface FlushOutcome {
  status: FlushStatus;
  sent: number;
  synced: number;
  failed: number;
}

export const MAX_BATCH = 100;
export const LAST_SYNC_KEY = "last_sync";

const httpStatus = (e: unknown): number | null =>
  typeof e === "object" && e !== null && typeof (e as { status?: unknown }).status === "number" ? (e as { status: number }).status : null;

export interface QueueDeps {
  uuid: () => string;
  now: () => Date;
  scope: () => Scope | null;
}

export function createQueue(store: QueueStore, deps: QueueDeps) {
  const isStamped = (e: Partial<QueueEntry>) => typeof e.user_id === "number" && typeof e.business_id === "number";
  /** Только записи текущего пользователя и бизнеса; legacy без штампа удаляются. */
  const sorted = async () => {
    const all = await store.all();
    for (const e of all) if (!isStamped(e)) await store.remove(e.client_id);
    const scope = deps.scope();
    if (!scope) return [];
    return all.filter((e) => isStamped(e) && e.user_id === scope.user_id && e.business_id === scope.business_id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  };

  async function enqueue(kind: QueueKind, payload: OperationPayload): Promise<QueueEntry> {
    const scope = deps.scope();
    if (!scope) throw new Error("no_session");
    const entry: QueueEntry = { client_id: deps.uuid(), ...scope, kind, payload, created_at: deps.now().toISOString(), error: null };
    await store.put(entry);
    return entry;
  }

  async function flush(send: SyncSender, opts: { retryFailed?: boolean } = {}): Promise<FlushOutcome> {
    const scope = deps.scope();
    const all = await sorted();
    if (!scope) return { status: "idle", sent: 0, synced: 0, failed: 0 };
    const due = all.filter((e) => opts.retryFailed || !e.error);
    if (!due.length) return { status: "idle", sent: 0, synced: 0, failed: 0 };
    let synced = 0;
    let failed = 0;
    let sent = 0;
    for (let i = 0; i < due.length; i += MAX_BATCH) {
      const batch = due.slice(i, i + MAX_BATCH);
      let results: SyncResult[];
      try {
        results = await send(batch.map(({ client_id, kind, payload }) => ({ client_id, kind, payload })), scope.business_id);
      } catch (e) {
        const code = httpStatus(e);
        const status: FlushStatus = code === 401 || code === 403 ? "unauthorized" : code === null ? "offline" : "failed";
        return { status, sent, synced, failed };
      }
      sent += batch.length;
      const byId = new Map(results.map((r) => [r.client_id, r]));
      for (const entry of batch) {
        const r = byId.get(entry.client_id);
        if (r && (r.status === "created" || r.status === "duplicate")) {
          await store.remove(entry.client_id);
          synced++;
        } else if (r) {
          await store.put({ ...entry, error: r.error ?? "error" });
          failed++;
        }
        // Нет в ответе — остаётся в очереди без ошибки, уйдёт в следующий раз.
      }
    }
    if (synced) await store.setMeta(LAST_SYNC_KEY, deps.now().toISOString());
    return { status: failed ? "partial" : "ok", sent, synced, failed };
  }

  return {
    enqueue,
    list: sorted,
    remove: (clientId: string) => store.remove(clientId),
    async count() {
      return (await sorted()).length;
    },
    async lastSync() {
      return store.getMeta(LAST_SYNC_KEY);
    },
    flush,
  };
}

export type OfflineQueue = ReturnType<typeof createQueue>;

export function memoryStore(): QueueStore {
  const items = new Map<string, QueueEntry>();
  const meta = new Map<string, string>();
  return {
    all: async () => [...items.values()].map((e) => ({ ...e })),
    put: async (e) => void items.set(e.client_id, { ...e }),
    remove: async (id) => void items.delete(id),
    getMeta: async (k) => meta.get(k) ?? null,
    setMeta: async (k, v) => void meta.set(k, v),
  };
}
