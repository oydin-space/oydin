"use client";

import Link from "next/link";
import { LogIn } from "lucide-react";
import { Wordmark } from "@/components/brand/logo";
import { Button, LanguagePicker } from "@/components/ui";
import { useLocale } from "@/i18n";
import { usePublicT } from "./use-public-t";

const NAV = [
  { href: "/", key: "public.nav.home" },
  { href: "/pricing", key: "public.nav.pricing" },
  { href: "/impact", key: "public.nav.impact" },
] as const;

const linkClass = "focus-ring min-target inline-flex items-center rounded-control px-2 text-small text-muted-foreground underline-offset-4 hover:text-foreground hover:underline";

/** Общая светлая оболочка публичных страниц: шапка, контент, подвал. */
export function PublicShell({ children }: { children: React.ReactNode }) {
  const t = usePublicT();
  const [locale, setLocale] = useLocale();
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="border-b border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-4 gap-y-1 px-page py-2 sm:flex-nowrap sm:px-page-lg">
          <Link href="/" className="focus-ring min-target order-1 inline-flex shrink-0 items-center rounded-control" aria-label="Oydin">
            <Wordmark size={32} />
          </Link>
          <div className="order-2 ml-auto flex shrink-0 items-center gap-2 sm:order-3">
            <LanguagePicker value={locale} onChange={setLocale} label={t("public.nav.language")} />
            <Button asChild size="sm" variant="secondary" icon={LogIn} className="hidden sm:inline-flex">
              <Link href="/login">{t("public.nav.login")}</Link>
            </Button>
          </div>
          <nav aria-label={t("public.nav.aria")} className="-mx-2 order-3 flex w-full flex-wrap items-center gap-x-1 sm:order-2 sm:w-auto sm:flex-1 sm:justify-center">
            {NAV.map((n) => (
              <Link key={n.href} href={n.href} className={linkClass}>
                {t(n.key)}
              </Link>
            ))}
            <Link href="/login" className={`${linkClass} sm:hidden`}>
              {t("public.nav.login")}
            </Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 break-words px-page py-8 sm:px-page-lg">{children}</main>
      <footer className="border-t border-border">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-page py-6 sm:px-page-lg">
          <nav aria-label="Oydin" className="-mx-2 flex flex-wrap gap-x-1">
            {[
              { href: "/", label: t("public.nav.home") },
              { href: "/pricing", label: t("public.nav.pricing") },
              { href: "/impact", label: t("public.nav.impact") },
              { href: "/login", label: t("public.nav.login") },
              { href: "/privacy", label: t("public.footer.privacy") },
              { href: "/terms", label: t("public.footer.terms") },
            ].map((l) => (
              <Link key={l.href} href={l.href} className={linkClass}>
                {l.label}
              </Link>
            ))}
          </nav>
          <p className="text-caption text-muted-foreground">{t("public.footer.note")}</p>
        </div>
      </footer>
    </div>
  );
}
