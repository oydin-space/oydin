"use client";

import { useEffect, useState } from "react";
import { Button, Input, OtpInput } from "@/components/ui";
import { errorText, saveConsent, type ConsentChoice, requestEmailCode, verifyEmailCode } from "@/lib/auth-api";
import type { Me } from "@/lib/types";
import { useAT } from "./use-at";

/** Почта → код → сессия. Согласие с документами записывается после успешного входа. */
export function EmailOtpForm({ consent, onSignedIn }: { consent: ConsentChoice; onSignedIn: (me: Me) => void }) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(0);

  const { t } = useAT();
  const errors: Record<string, string> = {
    invalid_code: t("auth.email.invalidCode"),
    rate_limited: t("auth.email.rateLimited"),
    http_429: t("auth.email.rateLimited"),
    email_not_configured: t("auth.email.notConfigured"),
    http_503: t("auth.email.notConfigured"),
    invalid_email: t("auth.email.invalidEmail"),
    http_400: t("auth.email.invalidEmail"),
  };

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!consent.terms) {
      setError(t("auth.email.needConsent"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const r = await requestEmailCode(email.trim());
      setLeft(r.resend_in || 60);
      setCode("");
      setStep("code");
    } catch (err) {
      setError(errorText(err, errors, t("auth.email.generic")));
    } finally {
      setBusy(false);
    }
  }

  async function verify(value: string) {
    setBusy(true);
    setError(null);
    try {
      const me = await verifyEmailCode(email.trim(), value);
      await saveConsent(consent).catch(() => undefined);
      onSignedIn(me);
    } catch (err) {
      setError(errorText(err, errors, t("auth.email.generic")));
      setCode("");
      setBusy(false);
    }
  }

  if (step === "code") {
    return (
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (code.length === 6) void verify(code);
        }}
      >
        <p className="text-small text-muted-foreground">{t("auth.email.sentTo", { email })}</p>
        <OtpInput value={code} onValueChange={setCode} onComplete={(v) => void verify(v)} label={t("auth.email.code")} error={error ?? undefined} disabled={busy} autoFocus />
        <Button type="submit" block loading={busy} disabled={code.length !== 6}>{t("auth.email.verify")}</Button>
        <Button variant="ghost" block disabled={left > 0 || busy} onClick={() => void send()}>{left > 0 ? t("auth.email.resendIn", { s: left }) : t("auth.email.resend")}</Button>
        <Button variant="ghost" block onClick={() => { setStep("email"); setError(null); }}>{t("auth.email.change")}</Button>
      </form>
    );
  }
  return (
    <form className="flex flex-col gap-4" onSubmit={send}>
      <Input type="email" name="email" label={t("auth.email.label")} hint={t("auth.email.hint")} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required error={error ?? undefined} />
      <Button type="submit" block loading={busy}>{t("auth.email.send")}</Button>
    </form>
  );
}
