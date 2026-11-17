"use client";

import { useEffect, useRef } from "react";
import { telegramWidgetLogin, type TelegramWidgetUser } from "@/lib/auth-api";
import type { Me } from "@/lib/types";

const BOT = process.env.NEXT_PUBLIC_TELEGRAM_BOT || "oydin_agent";
const CALLBACK = "__oydinTelegramAuth";

declare global {
  interface Window {
    [CALLBACK]?: (user: TelegramWidgetUser) => void;
  }
}

/** Кнопка Telegram Login Widget; после подтверждения шлёт подпись на бэкенд. `onBeforeLogin` — сохранить согласие до запроса. */
export function TelegramWidget({ onBeforeLogin, onSignedIn, onError }: { onBeforeLogin: () => void; onSignedIn: (me: Me) => void; onError: (e: unknown) => void }) {
  const host = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onBeforeLogin, onSignedIn, onError });
  useEffect(() => {
    handlers.current = { onBeforeLogin, onSignedIn, onError };
  });

  useEffect(() => {
    const el = host.current;
    if (!el) return;
    window[CALLBACK] = (user) => {
      handlers.current.onBeforeLogin();
      telegramWidgetLogin(user).then((me) => handlers.current.onSignedIn(me), (e) => handlers.current.onError(e));
    };
    const script = document.createElement("script");
    script.async = true;
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.dataset.telegramLogin = BOT;
    script.dataset.size = "large";
    script.dataset.requestAccess = "write";
    script.dataset.onauth = `${CALLBACK}(user)`;
    el.appendChild(script);
    return () => {
      el.replaceChildren();
      delete window[CALLBACK];
    };
  }, []);

  return <div ref={host} className="flex min-h-10 justify-center" />;
}
