import { describe, expect, test } from "bun:test";
import { createQueue, memoryStore, type SyncResult, type SyncSender } from "./queue";

const payload = { amount: 5000, direction: "out" as const, category: "Аренда", account_id: 1 };
function make() {
  let n = 0;
  let t = 0;
  const store = memoryStore();
  const q = createQueue(store, { uuid: () => `id-${++n}`, now: () => new Date(Date.UTC(2026, 0, 1, 0, 0, ++t)) });
  return { q, store };
}
const ok = (ids: string[]): SyncResult[] => ids.map((client_id) => ({ client_id, status: "created", id: 1, error: null }));

describe("offline queue", () => {
  test("enqueue keeps order and shape", async () => {
    const { q } = make();
    await q.enqueue("operation", payload);
    await q.enqueue("operation", { ...payload, amount: 1 });
    const list = await q.list();
    expect(list.map((e) => e.client_id)).toEqual(["id-1", "id-2"]);
    expect(list[0]).toMatchObject({ kind: "operation", payload });
    expect(await q.count()).toBe(2);
  });

  test("flush removes synced and duplicate, records last sync", async () => {
    const { q } = make();
    await q.enqueue("operation", payload);
    await q.enqueue("operation", payload);
    const send: SyncSender = async (items) => [
      { client_id: items[0].client_id, status: "created", id: 5, error: null },
      { client_id: items[1].client_id, status: "duplicate", id: 6, error: null },
    ];
    expect(await q.flush(send)).toEqual({ status: "ok", sent: 2, synced: 2, failed: 0 });
    expect(await q.count()).toBe(0);
    expect(await q.lastSync()).not.toBeNull();
  });

  test("partial failure keeps failed entry with error and skips it until retry", async () => {
    const { q } = make();
    await q.enqueue("operation", payload);
    await q.enqueue("operation", payload);
    const send: SyncSender = async (items) => [
      { client_id: items[0].client_id, status: "created", id: 1, error: null },
      { client_id: items[1].client_id, status: "error", id: null, error: "invalid_item" },
    ];
    expect(await q.flush(send)).toMatchObject({ status: "partial", synced: 1, failed: 1 });
    const left = await q.list();
    expect(left).toHaveLength(1);
    expect(left[0].error).toBe("invalid_item");
    expect((await q.flush(async () => ok([])) ).status).toBe("idle");
    let seen = 0;
    await q.flush(async (items) => ((seen = items.length), ok(items.map((i) => i.client_id))), { retryFailed: true });
    expect(seen).toBe(1);
    expect(await q.count()).toBe(0);
  });

  test("401 keeps the whole queue", async () => {
    const { q } = make();
    await q.enqueue("operation", payload);
    const out = await q.flush(async () => {
      throw { status: 401 };
    });
    expect(out.status).toBe("unauthorized");
    expect(await q.count()).toBe(1);
    expect((await q.list())[0].error).toBeNull();
  });

  test("network error means offline and keeps queue", async () => {
    const { q } = make();
    await q.enqueue("operation", payload);
    const out = await q.flush(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(out.status).toBe("offline");
    expect(await q.count()).toBe(1);
    expect(await q.lastSync()).toBeNull();
  });

  test("resending after lost response is idempotent by client_id", async () => {
    const { q } = make();
    const e = await q.enqueue("operation", payload);
    const seenIds: string[] = [];
    await q.flush(async (items) => {
      seenIds.push(items[0].client_id);
      throw new TypeError("lost");
    });
    await q.flush(async (items) => {
      seenIds.push(items[0].client_id);
      return [{ client_id: items[0].client_id, status: "duplicate", id: 9, error: null }];
    });
    expect(seenIds).toEqual([e.client_id, e.client_id]);
    expect(await q.count()).toBe(0);
  });

  test("batches by 100", async () => {
    const { q } = make();
    for (let i = 0; i < 101; i++) await q.enqueue("operation", payload);
    const sizes: number[] = [];
    const out = await q.flush(async (items) => (sizes.push(items.length), ok(items.map((i) => i.client_id))));
    expect(sizes).toEqual([100, 1]);
    expect(out.synced).toBe(101);
  });

  test("remove drops an entry", async () => {
    const { q } = make();
    const e = await q.enqueue("operation", payload);
    await q.remove(e.client_id);
    expect(await q.count()).toBe(0);
  });
});
