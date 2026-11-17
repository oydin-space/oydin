"use client";

import { CalendarDays, Gauge, Package, ReceiptText } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { applyTelegramTheme, haptic } from "@/lib/telegram";
import { CrayonIcon, type CrayonName } from "@/components/brand/crayon-icon";
import { Logo, Wordmark } from "@/components/brand/logo";
import { useSession } from "@/components/providers/session-provider";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/app", label: "Пульс", icon: "pulse", fallback: Gauge },
  { href: "/app/calendar", label: "Календарь", icon: "calendar", fallback: CalendarDays },
  { href: "/app/operations", label: "Операции", icon: "operations", fallback: ReceiptText },
  { href: "/app/products", label: "Товары", icon: "products", fallback: Package },
] as const satisfies readonly { href: string; label: string; icon: CrayonName; fallback: typeof Gauge }[];

function NavLink({ item, active, rail }: { item: (typeof NAV)[number]; active: boolean; rail: boolean }) {
  return (
    <Link
      href={item.href}
      aria-current={active ? "page" : undefined}
      onClick={() => !active && haptic("select")}
      className={cn(
        "flex items-center rounded-2xl transition-[background-color,transform] active:scale-95",
        rail ? "flex-row gap-3 px-3 py-2 text-[0.95rem]" : "flex-1 flex-col gap-0.5 py-1 text-[0.68rem] font-medium",
        active ? (rail ? "bg-butter font-medium" : "text-ink") : "text-ink/55 hover:bg-muted",
      )}
    >
      <span className={cn("inline-flex rounded-full transition-opacity", !rail && !active && "opacity-70", !rail && active && "bg-butter px-3 py-0.5")}><CrayonIcon name={item.icon} fallback={item.fallback} size={rail ? 30 : 26} /></span>
      {item.label}
    </Link>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const { user } = useSession();
  const isActive = (href: string) => (href === "/app" ? path === "/app" : path.startsWith(href));
  const current = NAV.find((n) => isActive(n.href));
  const mainRef = useRef<HTMLElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => applyTelegramTheme(), []);
  // Клавиатура: visualViewport сжимает приложение, а не сдвигает страницу.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement.style;
    const on = () => {
      root.setProperty("--app-h", `${Math.round(vv.height)}px`);
      if (vv.offsetTop > 0) window.scrollTo(0, 0);
    };
    on();
    vv.addEventListener("resize", on);
    vv.addEventListener("scroll", on);
    return () => {
      vv.removeEventListener("resize", on);
      vv.removeEventListener("scroll", on);
      root.removeProperty("--app-h");
    };
  }, []);
  useEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const on = () => setScrolled(el.scrollTop > 36);
    on();
    el.addEventListener("scroll", on, { passive: true });
    return () => el.removeEventListener("scroll", on);
  }, [path]);

  const showTitle = scrolled && path !== "/app";
  return (
    <div className="flex h-[var(--app-h,100dvh)] flex-col lg:flex-row">
      <aside className="pt-safe glass hidden w-64 shrink-0 flex-col gap-6 border-r border-border/70 p-4 lg:flex">
        <Wordmark />
        <nav className="flex flex-col gap-1" aria-label="Разделы">
          {NAV.map((n) => <NavLink key={n.href} item={n} active={isActive(n.href)} rail />)}
        </nav>
        <p className="mt-auto truncate text-sm text-muted-foreground">{user?.business?.name}</p>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className={cn("glass relative z-10 grid shrink-0 grid-cols-[2.5rem_1fr_2.5rem] items-center px-4 pb-2 pt-[max(env(safe-area-inset-top),var(--tg-top),0.75rem)] transition-[box-shadow] lg:hidden", showTitle ? "shadow-[0_0.5px_0_var(--border)]" : "shadow-none")}>
          <Logo size={30} />
          <div className="relative h-6 text-center">
            <span className={cn("absolute inset-0 truncate text-[0.95rem] font-semibold transition-all duration-200", showTitle ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0")} aria-hidden={!showTitle}>
              {current?.label}
            </span>
            <span className={cn("absolute inset-0 truncate text-sm text-muted-foreground transition-opacity duration-200", showTitle ? "opacity-0" : "opacity-100")}>{user?.business?.name}</span>
          </div>
        </header>
        <main ref={mainRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-2 lg:px-8 lg:pt-8 [&:has(>[data-fill])]:overflow-hidden [&:has(>[data-fill])]:pb-0">
          {children}
        </main>
        <nav className="pb-safe glass relative z-10 flex gap-1 border-t border-border/70 px-2 pt-1.5 lg:hidden" aria-label="Разделы">
          {NAV.map((n) => <NavLink key={n.href} item={n} active={isActive(n.href)} rail={false} />)}
        </nav>
      </div>
    </div>
  );
}
