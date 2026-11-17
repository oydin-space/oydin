export interface TelegramWebApp {
  initData: string;
  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  setBottomBarColor?(color: string): void;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  onEvent?(event: string, cb: () => void): void;
  offEvent?(event: string, cb: () => void): void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

/** Мини-приложение открыто из Telegram: в хэше или query есть tgWebAppData. */
export function hasTelegramLaunchParams(): boolean {
  if (typeof window === "undefined") return false;
  return /tgWebAppData=/.test(window.location.hash) || /tgWebAppData=/.test(window.location.search);
}
