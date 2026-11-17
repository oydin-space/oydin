"use client";

import { useEffect, useState } from "react";
import { Button, Input, OtpInput } from "@/components/ui";
import { errorText, saveConsent, type ConsentChoice, requestEmailCode, verifyEmailCode } from "@/lib/auth-api";
import type { Me } from "@/lib/types";

const strings = {
  email: "Электронная почта",
  emailHint: "Пришлём 6-значный код",
  send: "Получить код",
  code: "Код из письма",
  verify: "Войти",
  sentTo: (email: string) => `Код отправлен на ${email}`,
  resendIn: (s: number) => `Отправить повторно через ${s} с`,
  resend: "Отправить код ещё раз",
  change: "Другая почта",
  needConsent: "Нужно согласие на обработку данных, чтобы продолжить.",
  generic: "Не получилось. Попробуйте ещё раз.",
  errors: {
    invalid_code: "Неверный код. Проверьте письмо и введите снова.",
    rate_limited: "Слишком много попыток. Подождите немного и повторите.",
    http_429: "Слишком много попыток. Подождите немного и повторите.",
    email_not_configured: "Вход по почте пока не настроен. Выберите другой способ.",
    http_503: "Вход по почте пока не настроен. Выберите другой способ.",
    invalid_email: "Проверьте адрес почты.",
    http_400: "Проверьте адрес почты.",
  } as Record<string, string>,
};

/** Почта → код → сессия. Согласие с документами записывается после успешного входа. */
export function EmailOtpForm({ consent, onSignedIn }: { consent: ConsentChoice; onSignedIn: (me: Me) => void }) {
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const t = setTimeout(() => setLeft((n) => n - 1), 1000);
    return () => clearTimeout(t);
  }, [left]);

  async function send(e?: React.FormEvent) {
    e?.preventDefault();
    if (!consent.terms) {
      setError(strings.needConsent);
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
      setError(errorText(err, strings.errors, strings.generic));
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
      setError(errorText(err, strings.errors, strings.generic));
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
        <p className="text-small text-muted-foreground">{strings.sentTo(email)}</p>
        <OtpInput value={code} onValueChange={setCode} onComplete={(v) => void verify(v)} label={strings.code} error={error ?? undefined} disabled={busy} autoFocus />
        <Button type="submit" block loading={busy} disabled={code.length !== 6}>{strings.verify}</Button>
        <Button variant="ghost" block disabled={left > 0 || busy} onClick={() => void send()}>{left > 0 ? strings.resendIn(left) : strings.resend}</Button>
        <Button variant="ghost" block onClick={() => { setStep("email"); setError(null); }}>{strings.change}</Button>
      </form>
    );
  }
  return (
    <form className="flex flex-col gap-4" onSubmit={send}>
      <Input type="email" name="email" label={strings.email} hint={strings.emailHint} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required error={error ?? undefined} />
      <Button type="submit" block loading={busy}>{strings.send}</Button>
    </form>
  );
}
