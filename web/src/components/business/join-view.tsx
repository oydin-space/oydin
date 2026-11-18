"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Check, House, LogIn } from "lucide-react";
import { Button, Card, ErrorState, SkeletonList, Text } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { errorText } from "@/lib/auth-api";
import { useT } from "@/i18n";
import { acceptInvite, previewInvite, type InvitePreview } from "./invite-api";
import { roleLabel } from "./roles";

/** Ключ для login/onboarding: код приглашения переживает вход и регистрацию. */
export const PENDING_INVITE_KEY = "oydin.pendingInvite";

type State = { kind: "loading" } | { kind: "ready"; invite: InvitePreview; authed: boolean } | { kind: "gone"; code: string } | { kind: "failed" };

export function JoinView({ code }: { code: string }) {
  const t = useT();
  const router = useRouter();
  const [state, setState] = useState<State>({ kind: "loading" });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let off = false;
    // Reaching the join page consumes the pending invite; signIn() stores it again if needed.
    try {
      sessionStorage.removeItem(PENDING_INVITE_KEY);
    } catch {}
    (async () => {
      try {
        const invite = await previewInvite(code);
        const authed = await fetch("/api/auth/me/", { credentials: "include" }).then((r) => r.ok, () => false);
        if (!off) setState({ kind: "ready", invite, authed });
      } catch (e) {
        if (off) return;
        setState(e instanceof ApiError && (e.status === 404 || e.status === 410) ? { kind: "gone", code: e.status === 404 ? "not_found" : e.message } : { kind: "failed" });
      }
    })();
    return () => {
      off = true;
    };
  }, [code, attempt]);

  const errors: Record<string, string> = {
    invite_expired: t("settings.join.err.invite_expired"),
    invite_revoked: t("settings.join.err.invite_revoked"),
    invite_used_up: t("settings.join.err.invite_used_up"),
    not_found: t("settings.join.err.not_found"),
    http_410: t("settings.join.err.invite_expired"),
    http_404: t("settings.join.err.not_found"),
  };

  function signIn() {
    try {
      sessionStorage.setItem(PENDING_INVITE_KEY, code);
    } catch {}
    router.push(`/login?next=${encodeURIComponent(`/join/${code}`)}`);
  }

  async function accept() {
    setBusy(true);
    setError(null);
    try {
      await acceptInvite(code);
      try {
        sessionStorage.removeItem(PENDING_INVITE_KEY);
      } catch {}
      window.location.assign("/app");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return signIn();
      setError(errorText(e, errors, t("settings.common.generic")));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <Logo size={48} />
        <h1 className="text-page font-bold tracking-tight">{t("settings.join.title")}</h1>
      </header>
      {state.kind === "loading" ? (
        <SkeletonList rows={2} />
      ) : state.kind === "failed" ? (
        <ErrorState message={t("settings.join.loadError")} onRetry={() => { setState({ kind: "loading" }); setAttempt((n) => n + 1); }} />
      ) : state.kind === "gone" ? (
        <Card className="flex flex-col gap-3 text-center">
          <Text tone="muted">{errors[state.code] ?? t("settings.join.err.not_found")}</Text>
          <Button variant="secondary" icon={House} block onClick={() => router.push("/")}>{t("settings.join.home")}</Button>
        </Card>
      ) : (
        <Card className="flex flex-col gap-4 text-center">
          <p className="text-title font-semibold">{state.invite.business_name}</p>
          <Text tone="muted">{t("settings.join.role", { role: roleLabel(t, state.invite.role) })}</Text>
          {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
          {state.authed ? (
            <Button block icon={Check} loading={busy} onClick={() => void accept()}>{t("settings.join.accept")}</Button>
          ) : (
            <>
              <Button block icon={LogIn} onClick={signIn}>{t("settings.join.signIn")}</Button>
              <Text tone="muted" className="text-caption">{t("settings.join.signInHint")}</Text>
            </>
          )}
        </Card>
      )}
    </main>
  );
}
