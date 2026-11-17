"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { useSession } from "@/components/providers/session-provider";
import { Button, Card, Input, MoneyInput, SegmentedControl, SkeletonList, Text } from "@/components/ui";
import { createAccount, createBusiness, errorText, setSegment, type AccountKind, type Segment } from "@/lib/auth-api";
import type { Currency } from "@/lib/types";
import { SegmentSelect } from "./segment-select";

const strings = {
  title: "Настроим Oydin за минуту",
  hint: "Название, сфера и один счёт со стартовым остатком. Остальное добавите позже.",
  name: "Название бизнеса",
  account: "Первый счёт",
  accountName: "Название счёта",
  accountDefault: "Касса",
  kind: "Тип счёта",
  kinds: { cash: "Наличные", card: "Карта", bank: "Расчётный" } satisfies Record<AccountKind, string>,
  currency: "Валюта",
  balance: "Сколько денег там сейчас",
  submit: "Начать",
  required: "Заполните поле",
  pickSegment: "Выберите сферу",
  generic: "Не получилось сохранить. Попробуйте ещё раз.",
  errors: { http_400: "Проверьте введённые данные.", http_403: "Нет доступа." } as Record<string, string>,
};

export function OnboardingView() {
  const router = useRouter();
  const { user, status, refresh } = useSession();
  const [name, setName] = useState("");
  const [segment, setSeg] = useState<Segment>();
  const [accountName, setAccountName] = useState(strings.accountDefault);
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
      setError(errorText(err, strings.errors, strings.generic));
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-6 px-4 py-8">
      <header className="flex flex-col items-center gap-2 text-center">
        <Logo size={48} />
        <h1 className="text-page font-bold tracking-tight">{strings.title}</h1>
        <Text tone="muted">{strings.hint}</Text>
      </header>
      {status !== "ready" ? (
        <SkeletonList rows={4} />
      ) : (
        <form onSubmit={submit} noValidate>
          <Card className="flex flex-col gap-4">
            <Input label={strings.name} value={name} onChange={(e) => setName(e.target.value)} maxLength={120} required error={touched && !name.trim() ? strings.required : undefined} />
            <SegmentSelect value={segment} onValueChange={setSeg} error={touched && !segment ? strings.pickSegment : undefined} />
            <Text variant="section" weight="semibold" as="h2">{strings.account}</Text>
            <Input label={strings.accountName} value={accountName} onChange={(e) => setAccountName(e.target.value)} maxLength={80} required error={touched && !accountName.trim() ? strings.required : undefined} />
            <SegmentedControl label={strings.kind} value={kind} onValueChange={setKind} options={(Object.keys(strings.kinds) as AccountKind[]).map((v) => ({ value: v, label: strings.kinds[v] }))} />
            <SegmentedControl label={strings.currency} value={currency} onValueChange={setCurrency} options={[{ value: "UZS", label: "UZS" }, { value: "USD", label: "USD" }]} />
            <MoneyInput label={strings.balance} value={balance} onValueChange={setBalance} currency={currency} />
            {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
            <Button type="submit" block loading={busy}>{strings.submit}</Button>
          </Card>
        </form>
      )}
    </main>
  );
}
