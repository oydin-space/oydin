"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, ApiError, post } from "@/lib/api";
import type { User } from "@/lib/types";
import { useTelegram } from "./telegram-provider";

type Status = "loading" | "ready" | "error";

interface SessionState {
  user: User | null;
  status: Status;
  error: string | null;
  retry: () => void;
}

const Ctx = createContext<SessionState | null>(null);

export function useSession(): SessionState {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSession вне SessionProvider");
  return v;
}

/** /me → при 401: Telegram initData → /auth/telegram/, иначе демо-вход /auth/demo/. */
export function SessionProvider({ children }: { children: ReactNode }) {
  const tg = useTelegram();
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
            me = await api<User>("/me/");
          } catch (e) {
            if (!(e instanceof ApiError) || e.status !== 401) throw e;
            me = await post<User>("/auth/demo/");
          }
        }
        if (!cancelled) {
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
  }, [tg.status, tg.initData, attempt]);

  const retry = useCallback(() => {
    setStatus("loading");
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo(() => ({ user, status, error, retry }), [user, status, error, retry]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
