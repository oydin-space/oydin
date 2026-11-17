"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { Logo } from "@/components/brand/logo";
import { Button, Card, ErrorState, LanguageSwitcher, SkeletonList, Text } from "@/components/ui";
import { ConsentNotice } from "@/components/legal/consent-notice";
import { demoLogin, errorText, fetchProviders, noConsent, stashConsent, type ConsentChoice } from "@/lib/auth-api";
import type { AuthProviders, Me } from "@/lib/types";
import { hasTelegramLaunchParams } from "@/lib/telegram";
import { EmailOtpForm } from "./email-otp-form";
import { TelegramWidget } from "./telegram-widget";
import { useAT } from "./use-at";

const noopSubscribe = () => () => undefined;
const inTelegram = () => hasTelegramLaunchParams() || !!window.Telegram?.WebApp?.initData;

/** Только относительные пути внутри приложения. */
const safeNext = (next: string | null) => (next && next.startsWith("/app") && !next.startsWith("//") ? next : "/app");

export function LoginView({ next }: { next: string | null }) {
  const { t, locale } = useAT();
  const router = useRouter();
  const target = safeNext(next);
  const [providers, setProviders] = useState<AuthProviders | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [consent, setConsent] = useState<ConsentChoice>(noConsent);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    fetchProviders().then((p) => !off && (setProviders(p), setLoadFailed(false)), () => !off && setLoadFailed(true));
    return () => {
      off = true;
    };
  }, [attempt]);

  const errors: Record<string, string> = { http_503: t("auth.demoUnavailable") };
  const done = (me: Me) => router.replace(me.needs_onboarding ? "/onboarding" : target);

  async function demo() {
    setBusy(true);
    setError(null);
    try {
      done(await demoLogin());
    } catch (e) {
      setError(errorText(e, errors, t("auth.generic")));
      setBusy(false);
    }
  }

  const inMiniApp = useSyncExternalStore(noopSubscribe, inTelegram, () => true);
  const showTelegram = !!providers?.telegram && !inMiniApp;
  const any = providers && (providers.email || providers.google || providers.demo || showTelegram);
  return (
    <main className="relative mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <LanguageSwitcher className="absolute right-4 top-4 w-auto" />
      <header className="flex flex-col items-center gap-2 text-center">
        <Logo size={48} />
        <h1 className="text-page font-bold tracking-tight">{t("auth.login.title")}</h1>
        <Text tone="muted">{t("auth.login.hint")}</Text>
      </header>
      {loadFailed ? (
        <ErrorState message={t("auth.loadError")} onRetry={() => { setLoadFailed(false); setAttempt((n) => n + 1); }} />
      ) : !providers ? (
        <SkeletonList rows={3} />
      ) : (
        <Card className="flex flex-col gap-4">
          <ConsentNotice locale={locale} value={consent} onChange={setConsent} disabled={busy} />
          {providers.email ? <EmailOtpForm consent={consent} onSignedIn={done} /> : null}
          {providers.email && (providers.google || providers.demo) ? <p className="text-center text-small text-muted-foreground">{t("auth.or")}</p> : null}
          {providers.google ? (
            <Button
              asChild
              variant="secondary"
              block
              aria-disabled={!consent.terms}
              onClick={(e) => {
                if (!consent.terms) {
                  e.preventDefault();
                  setError(t("auth.needConsentLogin"));
                } else stashConsent(consent);
              }}
            >
              <a href={`/api/auth/google/start/?next=${encodeURIComponent(target)}`}>{t("auth.google")}</a>
            </Button>
          ) : null}
          {showTelegram ? (
            consent.terms ? (
              <TelegramWidget
                onBeforeLogin={() => stashConsent(consent)}
                onSignedIn={done}
                onError={(e) => setError(errorText(e, errors, t("auth.generic")))}
              />
            ) : (
              <Button variant="secondary" block disabled onClick={() => setError(t("auth.needConsentLogin"))}>{t("auth.telegram")}</Button>
            )
          ) : null}
          {providers.demo ? <Button variant="ghost" block loading={busy} onClick={demo}>{t("auth.demo")}</Button> : null}
          {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
          {!any ? <p className="text-small text-muted-foreground">{t("auth.none")}</p> : null}
        </Card>
      )}
    </main>
  );
}
