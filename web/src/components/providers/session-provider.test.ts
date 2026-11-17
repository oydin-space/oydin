import { describe, expect, test } from "bun:test";
import { ApiError } from "@/lib/api";
import type { User } from "@/lib/types";
import { loadMe, ME_SNAPSHOT_KEY } from "./session-provider";

function mem(initial?: string) {
  const m = new Map<string, string>();
  if (initial) m.set(ME_SNAPSHOT_KEY, initial);
  return {
    m,
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
}
const me = { id: 1 } as unknown as User;
const netFail = () => Promise.reject(new TypeError("Failed to fetch"));

describe("loadMe", () => {
  test("success stores snapshot", async () => {
    const s = mem();
    const r = await loadMe(async () => me, s);
    expect(r).toEqual({ me, offline: false });
    expect(s.m.get(ME_SNAPSHOT_KEY)).toBe(JSON.stringify(me));
  });
  test("network error + snapshot -> offline user", async () => {
    const s = mem(JSON.stringify(me));
    expect(await loadMe(netFail, s, () => false)).toEqual({ me, offline: true });
  });
  test("network error without snapshot -> throws", async () => {
    await expect(loadMe(netFail, mem(), () => false)).rejects.toThrow("Failed to fetch");
  });
  test("401 clears snapshot", async () => {
    const s = mem(JSON.stringify(me));
    await expect(loadMe(() => Promise.reject(new ApiError(401, "x")), s)).rejects.toBeInstanceOf(ApiError);
    expect(s.m.has(ME_SNAPSHOT_KEY)).toBe(false);
  });
  test("500 never uses snapshot", async () => {
    const s = mem(JSON.stringify(me));
    await expect(loadMe(() => Promise.reject(new ApiError(500, "x")), s)).rejects.toBeInstanceOf(ApiError);
    expect(s.m.has(ME_SNAPSHOT_KEY)).toBe(true);
  });
});
