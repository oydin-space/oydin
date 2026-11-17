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
