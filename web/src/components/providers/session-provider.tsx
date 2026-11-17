"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { api, ApiError, post } from "@/lib/api";
import { flushStashedConsent } from "@/lib/auth-api";
import type { User } from "@/lib/types";
import { useTelegram } from "./telegram-provider";

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
        } else {
          try {
            me = await api<User>("/auth/me/");
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
          setError(e instanceof Error ? e.message : "Не удалось войти");
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

  const applyMe = useCallback((me: User) => setUser(me), []);
  const refresh = useCallback(async () => {
    setUser(await api<User>("/auth/me/"));
  }, []);

  const retry = useCallback(() => {
    setStatus("loading");
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo(() => ({ user, status, error, retry, applyMe, refresh }), [user, status, error, retry, applyMe, refresh]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
