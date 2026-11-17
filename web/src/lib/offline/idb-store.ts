import type { QueueEntry, QueueStore } from "./queue";

const DB = "oydin-offline";
const ENTRIES = "entries";
const META = "meta";

let opened: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  opened ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(ENTRIES, { keyPath: "client_id" });
      req.result.createObjectStore(META);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      opened = null;
      reject(req.error);
    };
  });
  return opened;
}

async function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const req = fn(db.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const idbStore: QueueStore = {
  all: () => run<QueueEntry[]>(ENTRIES, "readonly", (s) => s.getAll()),
  put: (e) => run(ENTRIES, "readwrite", (s) => s.put(e)).then(() => undefined),
  remove: (id) => run(ENTRIES, "readwrite", (s) => s.delete(id)).then(() => undefined),
  getMeta: (k) => run<string | undefined>(META, "readonly", (s) => s.get(k)).then((v) => v ?? null),
  setMeta: (k, v) => run(META, "readwrite", (s) => s.put(v, k)).then(() => undefined),
};
