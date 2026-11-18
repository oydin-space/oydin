"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Check, StickyNote } from "lucide-react";
import { Button, Icon, Input, MoneyInput, SegmentedControl, Select, VoiceButton } from "@/components/ui";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { accountLabel, defaultAccountId, readLast, rememberLast } from "@/lib/offline/labels";
import { enqueueOperation } from "@/lib/offline/sync";
import type { Account } from "@/lib/types";
import { useVoiceRecorder, voiceFileName } from "@/lib/use-voice-recorder";
import { CategoryPicker } from "./category-picker";
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

export function QuickEntryForm({ accounts, online }: { accounts: Account[]; online: boolean }) {
  const t = useOfflineT();
  const { locale } = useI18n();
  const [direction, setDirection] = useState<Direction>("out");
  const [amount, setAmount] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("");
  const [accountId, setAccountId] = useState<string | undefined>();
  const [note, setNote] = useState("");
  const [errors, setErrors] = useState<{ amount?: string; account?: string; category?: string }>({});
  const [saving, setSaving] = useState(false);

  // Последняя использованная категория подставляется после монтирования (localStorage недоступен на сервере).
  const [lastApplied, setLastApplied] = useState(false);
  useEffect(() => {
    if (lastApplied) return;
    const id = setTimeout(() => {
      setLastApplied(true);
      setCategory((c) => c || (readLast("out") ?? ""));
    }, 0);
    return () => clearTimeout(id);
  }, [lastApplied]);

  const account = accounts.find((a) => String(a.id) === (accountId ?? defaultAccountId(accounts)));
  const chosenId = account ? String(account.id) : undefined;

  const pickDirection = (d: Direction) => {
    setDirection(d);
    setCategory(readLast(d) ?? "");
  };

  async function submit() {
    const next: typeof errors = {};
    if (!amount || amount <= 0) next.amount = t("offline.errAmount");
    if (!account) next.account = accounts.length ? t("offline.errAccount") : t("offline.errNoAccounts");
    if (!category.trim()) next.category = t("offline.errCategory");
    setErrors(next);
    if (next.amount || next.account || next.category || !amount || !account) return;
    setSaving(true);
    try {
      await enqueueOperation({ amount, direction, category: category.trim(), account_id: account.id, note: note.trim() || undefined, date: today() });
      rememberLast("account", String(account.id));
      rememberLast(direction, category.trim());
      toast.success(online ? t("offline.savedSynced") : t("offline.savedOffline"));
      setAmount(null);
      setNote("");
    } catch {
      toast.error(t("offline.saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  const { state: voice, supported: canVoice, toggle: onVoice } = useVoiceRecorder(
    async (blob) => {
      const body = new FormData();
      body.append("audio", blob, voiceFileName(blob));
      const res = await api<{ text: string; draft: VoiceDraft | null }>("/ai/voice/", { method: "POST", body });
      const d = res.draft;
      if (d?.amount) {
        setAmount(d.amount);
        if (d.direction === "in" || d.direction === "out") {
          setDirection(d.direction);
          setCategory(d.category ?? "");
        }
        if (d.account_id && accounts.some((a) => a.id === d.account_id)) setAccountId(String(d.account_id));
        setNote(d.note || res.text);
        toast.success(t("offline.voiceFilled"));
      } else {
        setNote(res.text);
      }
    },
    (kind) => toast.error(kind === "denied" ? t("offline.voiceDenied") : kind === "unavailable" ? t("offline.voiceUnavailable") : t("offline.voiceFailed")),
  );

  const autoVoice = useRef(false);
  useEffect(() => {
    if (autoVoice.current || !canVoice) return;
    if (new URLSearchParams(window.location.search).get("voice") !== "1") return;
    const id = setTimeout(() => {
      autoVoice.current = true;
      void onVoice();
    }, 0);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot on mount
  }, [canVoice]);

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

      <CategoryPicker label={t("offline.category")} direction={direction} value={category} onChange={setCategory} error={errors.category} required />

      <Select
        label={t("offline.account")}
        placeholder={t("offline.accountPlaceholder")}
        value={chosenId}
        onValueChange={setAccountId}
        options={accounts.map((a) => ({ value: String(a.id), label: accountLabel(a.name, t) }))}
        error={errors.account}
      />
      <Input label={t("offline.note")} placeholder={t("offline.notePlaceholder")} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} leading={<Icon icon={StickyNote} size={16} />} />

      <div className="flex items-center gap-3">
        <Button type="submit" size="lg" className="flex-1" icon={Check} loading={saving}>
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
