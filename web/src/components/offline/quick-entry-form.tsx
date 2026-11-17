"use client";

import { useRef, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { Button, Chip, Input, MoneyInput, SegmentedControl, Select, Text, VoiceButton, type VoiceState } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { CATEGORIES } from "@/lib/offline/reference";
import { enqueueOperation } from "@/lib/offline/sync";
import type { Account } from "@/lib/types";
import { recordVoice, voiceSupported } from "@/lib/voice";
import { useOfflineT } from "./use-offline-t";

type Direction = "in" | "out";

interface VoiceDraft {
  amount?: number;
  direction?: string;
  category?: string;
  account_id?: number;
  note?: string;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

const noopSubscribe = () => () => undefined;

export function QuickEntryForm({ accounts, online }: { accounts: Account[]; online: boolean }) {
  const t = useOfflineT();
  const { locale } = useI18n();
  const [direction, setDirection] = useState<Direction>("out");
  const [amount, setAmount] = useState<number | null>(null);
  const [category, setCategory] = useState<string>(CATEGORIES.out[0].value);
  const [accountId, setAccountId] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; account?: string }>({});
  const [saving, setSaving] = useState(false);
  const [voice, setVoice] = useState<VoiceState>("idle");
  const stopRef = useRef<AbortController | null>(null);
  const canVoice = useSyncExternalStore(noopSubscribe, voiceSupported, () => false);

  const account = accounts.find((a) => String(a.id) === (accountId ?? String(accounts[0]?.id)));
  const chosenId = account ? String(account.id) : undefined;

  const pickDirection = (d: Direction) => {
    setDirection(d);
    if (!CATEGORIES[d].some((c) => c.value === category)) setCategory(CATEGORIES[d][0].value);
  };

  async function submit() {
    const next: typeof errors = {};
    if (!amount || amount <= 0) next.amount = t("offline.errAmount");
    if (!account) next.account = accounts.length ? t("offline.errAccount") : t("offline.errNoAccounts");
    setErrors(next);
    if (next.amount || next.account || !amount || !account) return;
    setSaving(true);
    try {
      await enqueueOperation({ amount, direction, category, account_id: account.id, note: note.trim() || undefined, date: today() });
      toast.success(online ? t("offline.savedSynced") : t("offline.savedOffline"));
      setAmount(null);
      setNote("");
    } catch {
      toast.error(t("offline.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function onVoice() {
    if (voice === "recording") return stopRef.current?.abort();
    const ctl = new AbortController();
    stopRef.current = ctl;
    setVoice("recording");
    try {
      const blob = await recordVoice(ctl.signal);
      setVoice("processing");
      const body = new FormData();
      body.append("audio", blob, "voice");
      const res = await api<{ text: string; draft: VoiceDraft | null }>("/ai/voice/", { method: "POST", body });
      const d = res.draft;
      if (d?.amount) {
        setAmount(d.amount);
        if (d.direction === "in" || d.direction === "out") {
          setDirection(d.direction);
          setCategory(d.category ?? CATEGORIES[d.direction][0].value);
        }
        if (d.account_id && accounts.some((a) => a.id === d.account_id)) setAccountId(String(d.account_id));
        setNote(d.note || res.text);
        toast.success(t("offline.voiceFilled"));
      } else {
        setNote(res.text);
      }
    } catch (e) {
      toast.error(e instanceof DOMException && e.name === "NotAllowedError" ? t("offline.voiceDenied") : t("offline.voiceFailed"));
    } finally {
      setVoice("idle");
    }
  }

  const categories = CATEGORIES[direction];
  const knownCategory = categories.some((c) => c.value === category);
  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <SegmentedControl<Direction>
        label={t("offline.direction")}
        value={direction}
        onValueChange={pickDirection}
        options={[
          { value: "out", label: t("offline.out") },
          { value: "in", label: t("offline.in") },
        ]}
      />
      <MoneyInput label={t("offline.amount")} value={amount} onValueChange={setAmount} currency={account?.currency ?? "UZS"} locale={locale} error={errors.amount} />

      <div className="flex flex-col gap-2">
        <Text variant="secondary" tone="muted">
          {t("offline.category")}
        </Text>
        <div className="flex flex-wrap gap-2" role="group" aria-label={t("offline.category")}>
          {categories.map((c) => (
            <Chip key={c.value} selected={knownCategory && category === c.value} onSelect={() => setCategory(c.value)}>
              {t(c.key)}
            </Chip>
          ))}
        </div>
      </div>

      <Select
        label={t("offline.account")}
        placeholder={t("offline.accountPlaceholder")}
        value={chosenId}
        onValueChange={setAccountId}
        options={accounts.map((a) => ({ value: String(a.id), label: a.name }))}
        error={errors.account}
      />
      <Input label={t("offline.note")} placeholder={t("offline.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" className="flex-1" loading={saving}>
          {t("offline.save")}
        </Button>
        {online && canVoice ? (
          <VoiceButton
            state={voice}
            onPress={() => void onVoice()}
            size={56}
            labels={{ idle: t("offline.voice"), recording: t("offline.voiceStop"), processing: t("offline.voiceBusy") }}
          />
        ) : null}
      </div>
    </form>
  );
}
