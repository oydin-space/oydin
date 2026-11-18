"use client";

import { Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { telegramWidgetLogin, type TelegramWidgetUser } from "@/lib/auth-api";
import type { Me } from "@/lib/types";

const SCRIPT = "https://telegram.org/js/telegram-widget.js?22";

interface TelegramLoginApi {
  auth: (options: { bot_id: number; request_access?: "write"; lang?: string }, cb: (user: TelegramWidgetUser | false) => void) => void;
}
const loginApi = () => (window as unknown as { Telegram?: { Login?: TelegramLoginApi } }).Telegram?.Login;

let loading: Promise<void> | null = null;
/** Скрипт виджета грузится заранее и без iframe: кнопка остаётся нашей, окно авторизации открывается на языке интерфейса. */
function loadScript(): Promise<void> {
  if (loginApi()) return Promise.resolve();
  loading ??= new Promise<void>((resolve, reject) => {
    const s = document.createElement("script");
    s.async = true;
    s.src = SCRIPT;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      s.remove();
      reject(new Error("telegram_script"));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export interface TelegramLoginButtonProps {
  botId: number | null;
  label: string;
  locale: string;
  /** Условия приняты? Иначе клик вызывает onNeedTerms. */
  termsAccepted: boolean;
  onNeedTerms: () => void;
  onBeforeLogin: () => void;
  onSignedIn: (me: Me) => void;
  onError: (e: unknown) => void;
}

/** Фирменная кнопка «Войти через Telegram»; подпись виджета проверяет бэкенд. */
export function TelegramLoginButton({ botId, label, locale, termsAccepted, onNeedTerms, onBeforeLogin, onSignedIn, onError }: TelegramLoginButtonProps) {
  const [busy, setBusy] = useState(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    void loadScript().catch(() => undefined);
    return () => {
      alive.current = false;
    };
  }, []);

  const click = () => {
    if (!termsAccepted) return onNeedTerms();
    const login = loginApi();
    if (!login || botId == null) return onError(new Error("telegram_unavailable"));
    setBusy(true);
    login.auth({ bot_id: botId, request_access: "write", lang: locale }, (user) => {
      if (!user) return alive.current && setBusy(false);
      onBeforeLogin();
      telegramWidgetLogin(user).then(onSignedIn, (e) => {
        onError(e);
        if (alive.current) setBusy(false);
      });
    });
  };

  return (
    <Button variant="secondary" icon={Send} block loading={busy} aria-disabled={!termsAccepted || undefined} onClick={click}>
      {label}
    </Button>
  );
}
