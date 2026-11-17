export interface TelegramWebApp {
  initData: string;
  colorScheme?: "light" | "dark";
  ready(): void;
  expand(): void;
  setHeaderColor?(color: string): void;
  setBackgroundColor?(color: string): void;
  setBottomBarColor?(color: string): void;
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  themeParams?: Record<string, string>;
  BackButton?: { show(): void; hide(): void; onClick(cb: () => void): void; offClick(cb: () => void): void };
  HapticFeedback?: {
    impactOccurred(style: "light" | "medium" | "heavy" | "rigid" | "soft"): void;
    notificationOccurred(type: "error" | "success" | "warning"): void;
    selectionChanged(): void;
  };
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

const tg = () => (typeof window === "undefined" ? undefined : window.Telegram?.WebApp);

/** Лёгкая тактильная отдача: Telegram HapticFeedback, иначе navigator.vibrate. */
export function haptic(kind: "tap" | "select" | "success" | "error" = "tap") {
  const h = tg()?.HapticFeedback;
  if (h) {
    if (kind === "select") h.selectionChanged();
    else if (kind === "tap") h.impactOccurred("light");
    else h.notificationOccurred(kind);
  } else if (typeof navigator !== "undefined" && "vibrate" in navigator && kind !== "select") {
    navigator.vibrate(kind === "tap" ? 8 : kind === "success" ? [10, 40, 10] : 30);
  }
}

/** Показывает кнопку «назад» Telegram, пока active; возвращает функцию снятия. */
export function bindBackButton(cb: () => void): () => void {
  const b = tg()?.BackButton;
  if (!b) return () => {};
  b.onClick(cb);
  b.show();
  return () => {
    b.offClick(cb);
    b.hide();
  };
}

/** Тема Telegram: цвета и схема → CSS-переменные/атрибут (светлую/тёмную тему задаёт клиент). */
export function applyTelegramTheme(): () => void {
  const app = tg();
  if (!app) return () => {};
  const apply = () => {
    const root = document.documentElement;
    if (app.colorScheme) root.dataset.theme = app.colorScheme;
    const bg = getComputedStyle(root).getPropertyValue("--background").trim();
    if (bg) {
      app.setHeaderColor?.(bg);
      app.setBackgroundColor?.(bg);
      app.setBottomBarColor?.(bg);
    }
  };
  apply();
  app.onEvent?.("themeChanged", apply);
  return () => app.offEvent?.("themeChanged", apply);
}
