"use client";

import { useEffect } from "react";

const ENABLED = process.env.NODE_ENV === "production" || process.env.NEXT_PUBLIC_SW === "1";

/** Регистрирует /sw.js (только production или NEXT_PUBLIC_SW=1). Ничего не рисует. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!ENABLED || !("serviceWorker" in navigator)) return;
    const register = () => void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => undefined);
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);
  return null;
}
