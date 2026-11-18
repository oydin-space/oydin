// Область офлайн-данных: пользователь + активный бизнес из снимка сессии. Чужие записи очереди не видны и не уходят.
export const ME_SNAPSHOT_KEY = "oydin_me_v1";

export interface Scope {
  user_id: number;
  business_id: number;
}

export function currentScope(): Scope | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(ME_SNAPSHOT_KEY);
    if (!raw) return null;
    const me = JSON.parse(raw) as { id?: unknown; active_business_id?: unknown };
    return typeof me.id === "number" && typeof me.active_business_id === "number" ? { user_id: me.id, business_id: me.active_business_id } : null;
  } catch {
    return null;
  }
}

let generation = 0;
/** Растёт при любой смене сессии (вход, выход, смена бизнеса); прерывает идущую синхронизацию. */
export const scopeGeneration = () => generation;
export const invalidateScope = () => void generation++;

type SnapshotStorage = Pick<Storage, "setItem" | "removeItem">;

/** Единая точка записи снимка сессии для любого способа входа. */
export function writeMeSnapshot(storage: SnapshotStorage | null, me: unknown) {
  invalidateScope();
  try {
    storage?.setItem(ME_SNAPSHOT_KEY, JSON.stringify(me));
  } catch {}
}

export function removeMeSnapshot(storage: SnapshotStorage | null) {
  invalidateScope();
  try {
    storage?.removeItem(ME_SNAPSHOT_KEY);
  } catch {}
}
