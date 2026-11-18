"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronsUpDown, Plus } from "lucide-react";
import { useKitT } from "./kit-t";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  active?: boolean;
}

/** Нижняя панель: ровно 4 пункта, без «Добавить» (добавление — FAB). Учитывает safe-area Telegram. */
export function TabBar({ items, className }: { items: NavItem[]; className?: string }) {
  const t = useKitT();
  return (
    <nav aria-label={t("kit.nav.main")} className={cn("pb-safe glass fixed inset-x-0 bottom-0 z-40 border-t border-border md:hidden", className)}>
      <ul className="mx-auto grid max-w-lg grid-cols-4">
        {items.map(({ href, label, icon: I, active }) => (
          <li key={href}>
            <Link href={href} aria-current={active ? "page" : undefined} className={cn("focus-ring flex min-h-14 flex-col items-center justify-center gap-0.5 text-caption font-medium", active ? "text-foreground" : "text-muted-foreground")}>
              <I className="size-6" aria-hidden />
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** Боковая панель ≥768px: те же пункты, что в TabBar. */
export function Sidebar({ items, header, footer, className }: { items: NavItem[]; header?: React.ReactNode; footer?: React.ReactNode; className?: string }) {
  const t = useKitT();
  return (
    <aside className={cn("hidden w-64 shrink-0 flex-col gap-4 border-r border-border bg-card p-4 md:flex", className)}>
      {header}
      <nav aria-label={t("kit.nav.main")} className="flex-1">
        <ul className="flex flex-col gap-1">
          {items.map(({ href, label, icon: I, active }) => (
            <li key={href}>
              <Link href={href} aria-current={active ? "page" : undefined} className={cn("state-layer focus-ring flex min-h-11 items-center gap-3 rounded-control px-3 text-body", active ? "bg-muted font-semibold" : "text-muted-foreground")}>
                <I className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      {footer}
    </aside>
  );
}

/** Плавающая кнопка главного действия; поднята над TabBar на телефоне. */
export function FAB({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className={cn("state-layer press focus-ring fixed bottom-24 right-4 z-30 grid size-14 place-items-center rounded-pill bg-primary text-primary-foreground shadow-overlay md:bottom-8 md:right-8", className)}>
      <Plus className="size-6" aria-hidden="true" />
    </button>
  );
}

/** Кнопка текущей организации (открывает Sheet со списком). Только оболочка: данные приходят пропсами. */
export function BusinessSwitcher({ name, role, onClick, className }: { name: string; role?: string; onClick: () => void; className?: string }) {
  return (
    <button type="button" onClick={onClick} aria-haspopup="dialog" className={cn("state-layer focus-ring flex min-h-11 items-center gap-2 rounded-control px-2 text-left", className)}>
      <Logo size={32} />
      <span className="flex min-w-0 flex-col">
        <span className="truncate text-small font-semibold">{name}</span>
        {role ? <span className="truncate text-caption text-muted-foreground">{role}</span> : null}
      </span>
      <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
    </button>
  );
}

export function AppHeader({ leading, trailing, title, className }: { leading?: React.ReactNode; trailing?: React.ReactNode; title?: string; className?: string }) {
  return (
    <header className={cn("pt-safe glass sticky top-0 z-30 flex min-h-14 items-center gap-2 border-b border-border px-4", className)}>
      {leading}
      {title ? <h1 className="flex-1 truncate text-title font-semibold">{title}</h1> : <span className="flex-1" />}
      {trailing}
    </header>
  );
}

/** Крупный заголовок страницы; после прокрутки сворачивается в компактную полосу сверху. */
export function PageHeader({ title, hint, actions, className }: { title: string; hint?: string; actions?: React.ReactNode; className?: string }) {
  const [compact, setCompact] = useState(false);
  useEffect(() => {
    const on = () => setCompact(window.scrollY > 48);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <>
      <div aria-hidden={!compact} className={cn("pt-safe glass fixed inset-x-0 top-0 z-30 flex min-h-12 items-center justify-center border-b border-border text-small font-semibold transition-opacity duration-(--dur-base)", compact ? "opacity-100" : "pointer-events-none opacity-0")}>
        {title}
      </div>
      <header className={cn("mb-4 flex flex-wrap items-end justify-between gap-3 px-1 pt-1", className)}>
        <div className="min-w-0 flex-1 basis-48">
          <h1 className="text-page font-bold tracking-tight">{title}</h1>
          {hint ? <p className="mt-1 text-small text-muted-foreground">{hint}</p> : null}
        </div>
        {actions ? <div className="flex w-full flex-wrap gap-2 *:flex-1 sm:w-auto sm:*:flex-none">{actions}</div> : null}
      </header>
    </>
  );
}

export function Section({ title, action, className, children }: { title: string; action?: React.ReactNode; className?: string; children: React.ReactNode }) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 className="text-title font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
