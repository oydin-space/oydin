"use client";

import Script from "next/script";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { hasTelegramLaunchParams, type TelegramWebApp } from "@/lib/telegram";

type Status = "pending" | "none" | "loading" | "ready";

interface TelegramState {
  /** pending — ещё определяем среду; none — обычный браузер. */
  status: Status;
  isTelegram: boolean;
  initData: string;
}

const Ctx = createContext<TelegramState>({ status: "pending", isTelegram: false, initData: "" });
export const useTelegram = () => useContext(Ctx);

const SCRIPT = "https://telegram.org/js/telegram-web-app.js";
const FLAG = "oydin-tg";
const CREAM = "#fbf7ee";

function applySafeArea(app: TelegramWebApp) {
  const s = app.safeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const c = app.contentSafeAreaInset ?? { top: 0, bottom: 0, left: 0, right: 0 };
  const root = document.documentElement.style;
  root.setProperty("--tg-top", `${s.top + c.top}px`);
  root.setProperty("--tg-bottom", `${s.bottom + c.bottom}px`);
}

/**
 * Определяет Telegram Mini App. Скрипт telegram-web-app.js грузится только если есть
 * tgWebAppData (хэш/query на первом заходе, дальше — флаг в sessionStorage) либо
 * Telegram.WebApp уже внедрён клиентом.
 */
export function TelegramProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>("pending");
  const [initData, setInitData] = useState("");

  useEffect(() => {
    const injected = !!window.Telegram?.WebApp?.initData;
    const launch = hasTelegramLaunchParams();
    if (launch) sessionStorage.setItem(FLAG, "1");
    const inTelegram = injected || launch || sessionStorage.getItem(FLAG) === "1";
    // Единоразовое определение среды после гидрации.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStatus(inTelegram ? "loading" : "none");
  }, []);

  const init = useCallback(() => {
    const app = window.Telegram?.WebApp;
    if (!app) {
      setStatus("none");
      return;
    }
    app.ready();
    app.expand();
    app.setHeaderColor?.(CREAM);
    app.setBackgroundColor?.(CREAM);
    app.setBottomBarColor?.(CREAM);
    applySafeArea(app);
    const onChange = () => applySafeArea(app);
    app.onEvent?.("safeAreaChanged", onChange);
    app.onEvent?.("contentSafeAreaChanged", onChange);
    setInitData(app.initData);
    setStatus("ready");
  }, []);

  // Скрипт мог быть уже загружен клиентом Telegram.
  useEffect(() => {
    if (status === "loading" && window.Telegram?.WebApp) queueMicrotask(init);
  }, [status, init]);

  const value = useMemo<TelegramState>(
    () => ({ status, isTelegram: status === "ready" || status === "loading", initData }),
    [status, initData],
  );

  return (
    <Ctx.Provider value={value}>
      {status === "loading" ? <Script src={SCRIPT} strategy="afterInteractive" onLoad={init} onError={() => setStatus("none")} /> : null}
      {children}
    </Ctx.Provider>
  );
}
