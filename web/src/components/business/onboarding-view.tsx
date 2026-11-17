"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { useSession } from "@/components/providers/session-provider";
import { Button, Card, Input, MoneyInput, SegmentedControl, SkeletonList, Text } from "@/components/ui";
import { createAccount, createBusiness, errorText, setSegment, type AccountKind, type Segment } from "@/lib/auth-api";
import type { Currency } from "@/lib/types";
import { useAT, type AKey } from "@/components/auth/use-at";
import { SegmentSelect } from "./segment-select";

const KINDS: AccountKind[] = ["cash", "card", "bank"];

export function OnboardingView() {
  const { t } = useAT();
  const router = useRouter();
  const { user, status, refresh } = useSession();
  const [name, setName] = useState("");
  const [segment, setSeg] = useState<Segment>();
  const [accountName, setAccountName] = useState(t("auth.onboarding.accountDefault"));
  const [kind, setKind] = useState<AccountKind>("cash");
  const [currency, setCurrency] = useState<Currency>("UZS");
  const [balance, setBalance] = useState<number | null>(0);
  const [touched, setTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Бизнес создаётся один раз: при повторе после сбоя счёта его не дублируем.
  const created = useRef<{ id: number; segment: boolean } | null>(null);

  useEffect(() => {
    if (status === "ready" && user && !user.needs_onboarding) router.replace("/app");
  }, [status, user, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!name.trim() || !segment || !accountName.trim()) return;
    setBusy(true);
    setError(null);
    try {
      if (!created.current) created.current = { id: (await createBusiness({ name: name.trim() })).id, segment: false };
      if (!created.current.segment) {
        await setSegment(created.current.id, segment);
        created.current.segment = true;
      }
      await createAccount({ name: accountName.trim(), kind, currency, opening_balance: balance ?? 0 });
      await refresh();
      router.replace("/app");
    } catch (err) {
      setError(errorText(err, { http_400: t("auth.onboarding.badRequest"), http_403: t("auth.onboarding.forbidden") }, t("auth.onboarding.generic")));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <Logo size={48} />
        <h1 className="text-page font-bold tracking-tight">{t("auth.onboarding.title")}</h1>
        <Text tone="muted">{t("auth.onboarding.hint")}</Text>
      </header>
      {status !== "ready" ? (
        <SkeletonList rows={4} />
      ) : (
        <form onSubmit={submit} noValidate>
          <Card className="flex flex-col gap-4">
            <Input label={t("auth.onboarding.name")} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required error={touched && !name.trim() ? t("auth.onboarding.required") : undefined} />
            <SegmentSelect value={segment} onValueChange={setSeg} error={touched && !segment ? t("auth.onboarding.pickSegment") : undefined} />
            <Text variant="section" weight="semibold" as="h2">{t("auth.onboarding.account")}</Text>
            <Input label={t("auth.onboarding.accountName")} value={accountName} onChange={(e) => setAccountName(e.target.value)} maxLength={80} required error={touched && !accountName.trim() ? t("auth.onboarding.required") : undefined} />
            <SegmentedControl label={t("auth.onboarding.kind")} value={kind} onValueChange={setKind} options={KINDS.map((v) => ({ value: v, label: t(`auth.onboarding.kind.${v}` satisfies AKey) }))} />
            <SegmentedControl label={t("auth.onboarding.currency")} value={currency} onValueChange={setCurrency} options={[{ value: "UZS", label: "UZS" }, { value: "USD", label: "USD" }]} />
            <MoneyInput label={t("auth.onboarding.balance")} value={balance} onValueChange={setBalance} currency={currency} />
            {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
            <Button type="submit" block loading={busy}>{t("auth.onboarding.submit")}</Button>
          </Card>
        </form>
      )}
    </main>
  );
}
