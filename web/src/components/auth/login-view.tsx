"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Button, Card, ErrorState, SkeletonList, Text } from "@/components/ui";
import { ConsentNotice } from "@/components/legal/consent-notice";
import { demoLogin, errorText, fetchProviders, noConsent, stashConsent, type ConsentChoice } from "@/lib/auth-api";
import type { AuthProviders, Me } from "@/lib/types";
import { EmailOtpForm } from "./email-otp-form";

const strings = {
  title: "Вход в Oydin",
  hint: "Второй мозг для вашего бизнеса",
  google: "Войти через Google",
  demo: "Посмотреть демо",
  or: "или",
  none: "Способы входа сейчас недоступны.",
  loadError: "не удалось получить способы входа",
  errors: { http_503: "Демо сейчас недоступно." } as Record<string, string>,
  needConsent: "Отметьте согласие с условиями, чтобы войти.",
  generic: "Не получилось войти. Попробуйте ещё раз.",
};

/** Только относительные пути внутри приложения. */
const safeNext = (next: string | null) => (next && next.startsWith("/app") && !next.startsWith("//") ? next : "/app");

export function LoginView({ next }: { next: string | null }) {
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

  const done = (me: Me) => router.replace(me.needs_onboarding ? "/onboarding" : target);

  async function demo() {
    setBusy(true);
    setError(null);
    try {
      done(await demoLogin());
    } catch (e) {
      setError(errorText(e, strings.errors, strings.generic));
      setBusy(false);
    }
  }

  const any = providers && (providers.email || providers.google || providers.demo);
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <Logo size={48} />
        <h1 className="text-page font-bold tracking-tight">{strings.title}</h1>
        <Text tone="muted">{strings.hint}</Text>
      </header>
      {loadFailed ? (
        <ErrorState message={strings.loadError} onRetry={() => { setLoadFailed(false); setAttempt((n) => n + 1); }} />
      ) : !providers ? (
        <SkeletonList rows={3} />
      ) : (
        <Card className="flex flex-col gap-4">
          <ConsentNotice locale="ru" value={consent} onChange={setConsent} disabled={busy} />
          {providers.email ? <EmailOtpForm consent={consent} onSignedIn={done} /> : null}
          {providers.email && (providers.google || providers.demo) ? <p className="text-center text-small text-muted-foreground">{strings.or}</p> : null}
          {providers.google ? (
            <Button
              asChild
              variant="secondary"
              block
              aria-disabled={!consent.terms}
              onClick={(e) => {
                if (!consent.terms) {
                  e.preventDefault();
                  setError(strings.needConsent);
                } else stashConsent(consent);
              }}
            >
              <a href={`/api/auth/google/start/?next=${encodeURIComponent(target)}`}>{strings.google}</a>
            </Button>
          ) : null}
          {providers.demo ? <Button variant="ghost" block loading={busy} onClick={demo}>{strings.demo}</Button> : null}
          {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
          {!any ? <p className="text-small text-muted-foreground">{strings.none}</p> : null}
        </Card>
      )}
    </main>
  );
}
