"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError, post } from "@/lib/api";
import { flushStashedConsent } from "@/lib/auth-api";
import type { User } from "@/lib/types";
import { useTelegram } from "./telegram-provider";

import { ME_SNAPSHOT_KEY, removeMeSnapshot, writeMeSnapshot } from "@/lib/offline/scope";

export { ME_SNAPSHOT_KEY };

type SnapshotStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function browserStorage(): SnapshotStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

/** Выход из аккаунта: снимок Me больше не нужен. */
export function clearMeSnapshot(storage: SnapshotStorage | null = browserStorage()) {
  removeMeSnapshot(storage);
}

function readSnapshot(storage: SnapshotStorage | null): User | null {
  try {
    const raw = storage?.getItem(ME_SNAPSHOT_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

/**
 * GET /auth/me/ со снимком: успех → сохранить; 401/403 → стереть и пробросить;
 * сетевая ошибка (не HTTP-ответ) + снимок → офлайн-пользователь; иначе пробросить.
 */
export async function loadMe(
  fetchMe: () => Promise<User>,
  storage: SnapshotStorage | null,
  isOnline: () => boolean = () => typeof navigator === "undefined" || navigator.onLine !== false,
): Promise<{ me: User; offline: boolean }> {
  try {
    const me = await fetchMe();
    writeMeSnapshot(storage, me);
    return { me, offline: false };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 401 || e.status === 403) clearMeSnapshot(storage);
      throw e;
    }
    const snap = readSnapshot(storage);
    if (snap && (!isOnline() || e instanceof TypeError)) return { me: snap, offline: true };
    throw e;
  }
}

type Status = "loading" | "ready" | "error";

interface SessionState {
  user: User | null;
  status: Status;
  error: string | null;
  retry: () => void;
  /** Подменить пользователя ответом Me (например, после переключения бизнеса). */
  applyMe: (me: User) => void;
  /** Перечитать /auth/me/. */
  refresh: () => Promise<void>;
  /** true: /auth/me/ недоступен по сети, пользователь восстановлен из локального снимка. */
  offline: boolean;
}

const Ctx = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession вне SessionProvider");
  return v;
}

/** /auth/me/ → при 401: Telegram initData → /auth/telegram/, иначе страница входа. needs_onboarding → /onboarding. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const tg = useTelegram();
  const router = useRouter();
  const path = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [offline, setOffline] = useState(false);
  const [status, setStatus] = useState<Status>("loading");
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (tg.status === "pending" || tg.status === "loading") return;
    let cancelled = false;
    (async () => {
      try {
        let me: User;
        if (tg.initData) {
          me = await post<User>("/auth/telegram/", { init_data: tg.initData });
          writeMeSnapshot(browserStorage(), me);
        } else {
          try {
            const r = await loadMe(() => api<User>("/auth/me/"), browserStorage());
            me = r.me;
            if (r.offline && !cancelled) setOffline(true);
          } catch (e) {
            if (!(e instanceof ApiError) || e.status !== 401) throw e;
            router.replace(`/login?next=${encodeURIComponent(path)}`);
            return;
          }
        }
        if (!cancelled) {
          void flushStashedConsent();
          setUser(me);
          setStatus("ready");
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : null);
          setStatus("error");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // path намеренно вне зависимостей: сессию не перечитываем при навигации.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tg.status, tg.initData, attempt]);

  useEffect(() => {
    if (user?.needs_onboarding && path !== "/onboarding") router.replace("/onboarding");
  }, [user, path, router]);

  const applyMe = useCallback((me: User) => {
    writeMeSnapshot(browserStorage(), me);
    setUser(me);
  }, []);
  const refresh = useCallback(async () => {
    const r = await loadMe(() => api<User>("/auth/me/"), browserStorage());
    setUser(r.me);
    setOffline(r.offline);
  }, []);

  const retry = useCallback(() => {
    setStatus("loading");
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo(() => ({ user, status, error, offline, retry, applyMe, refresh }), [user, status, error, offline, retry, applyMe, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
