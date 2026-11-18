"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StickToBottom } from "use-stick-to-bottom";
import { Bookmark, Settings, ThumbsDown, ThumbsUp, Wand2 } from "lucide-react";
import { PromptBar } from "@/components/ai-chat/prompt-bar";
import { useSession } from "@/components/providers/session-provider";
import { Button, Card, Chip, EmptyState, IconButton, Spinner, StatusBanner, Text, toast } from "@/components/ui";
import { useApi } from "@/lib/use-api";
import type { Account } from "@/lib/types";
import { createTool } from "@/lib/tools-api";
import { recordVoice, voiceSupported } from "@/lib/voice";
import { AnswerChart } from "./answer-chart";
import { BuildUiSheet } from "./build-ui-sheet";
import { Logo } from "@/components/brand/logo";
import { useChatT } from "./chat-t";
import { DraftCard } from "./draft-card";
import { GenerativeUI } from "./generative-ui";
import { RichText } from "./rich-text";
import { useUiChat, type UiChat, type UiMessage } from "./use-ui-chat";

const STARTERS = ["chat.ui.p1", "chat.ui.p2", "chat.ui.p3", "chat.ui.p4"] as const;

/** /app/chat: помощник с генеративным UI, голосом, оценкой ответов и сохранением калькуляторов. */
export function ChatView() {
  const t = useChatT();
  const { user } = useSession();
  const chat = useUiChat();
  const accounts = useApi<{ items: Account[] }>(user?.role === "seller" ? null : "/accounts/");
  const [buildOpen, setBuildOpen] = useState(false);

  if (user?.role === "seller" || chat.block === "forbidden") {
    return (
      <div className="mx-auto w-full max-w-3xl pb-6">
        <EmptyState title={t("chat.ui.sellerTitle")} hint={t("chat.ui.sellerHint")} />
      </div>
    );
  }

  const last = chat.messages.at(-1);
  const chips = last?.role === "assistant" && last.suggestions?.length ? last.suggestions : chat.messages.length ? [] : STARTERS.map((k) => t(k));

  const onDictate = voiceSupported()
    ? async (stop: AbortSignal) => {
        try {
          const blob = await recordVoice(stop);
          if (blob.size) void chat.sendVoice(blob, t("chat.ui.listening"));
        } catch (e) {
          toast.error(e instanceof DOMException && e.name === "NotAllowedError" ? t("chat.ui.micDenied") : t("chat.ui.micFailed"));
        }
        return undefined;
      }
    : undefined;

  const consentOff = chat.block === "consent";

  return (
    <div data-fill className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col">
      <h1 className="sr-only">{t("chat.title" as never)}</h1>
      {consentOff ? (
        <StatusBanner
          kind="info"
          title={t("chat.ui.consentTitle")}
          action={
            <Button asChild variant="secondary" size="sm" icon={Settings}>
              <Link href="/app/settings">{t("chat.ui.enable")}</Link>
            </Button>
          }
        >
          {t("chat.ui.consentHint")}
        </StatusBanner>
      ) : null}
      <StickToBottom className="relative min-h-0 flex-1" resize="smooth" initial="instant">
        <StickToBottom.Content className="flex min-h-full flex-col gap-3 py-3">
          {!chat.messages.length ? (
            <div className="flex flex-col items-center gap-1 px-4 pt-2 text-center">
              <Logo size={40} />
              <Text weight="semibold">{t("chat.ui.empty")}</Text>
              <Text variant="caption" tone="muted">
                {t("chat.ui.hint")}
              </Text>
            </div>
          ) : null}
          {chat.messages.map((m) => (
            <Message key={m.id} message={m} accounts={accounts.data?.items ?? []} chat={chat} />
          ))}
          {chat.busy ? <Spinner variant="flower" size={36} className="self-start" /> : null}
          {chips.length && !chat.busy ? (
            <div className={chat.messages.length ? "flex flex-wrap gap-2" : "-mx-4 mt-auto flex gap-2 overflow-x-auto px-4 pb-1 [&>*]:shrink-0"}>
              {chips.map((s) => (
                <Chip key={s} disabled={consentOff} onSelect={() => void chat.send(s)}>
                  {s}
                </Chip>
              ))}
            </div>
          ) : null}
        </StickToBottom.Content>
      </StickToBottom>
      <div className="pb-0.5 pt-1">
        <div className="flex items-center gap-2">
          <IconButton icon={Wand2} label={t("chat.build.open")} variant="ghost" disabled={consentOff} onClick={() => setBuildOpen(true)} />
          <PromptBar
            disabled={consentOff}
            background="var(--card)"
            color="var(--foreground)"
            sparkColor="#b9a6f0"
            width={760}
            busy={chat.busy}
            placeholders={STARTERS.map((k) => t(k))}
            labels={{
              prompt: t("chat.ui.prompt"),
              send: t("chat.send" as never),
              stop: t("chat.ui.stop"),
              dictate: t("chat.ui.dictate"),
              dictateStop: t("chat.ui.dictateStop"),
              listening: t("chat.ui.recording"),
            }}
            onDictate={onDictate}
            onSend={(text) => void chat.send(text)}
          />
        </div>
        <Text variant="caption" tone="muted" className="mt-1 text-center">
          {t("chat.disclaimer" as never)}
        </Text>
      </div>
      <BuildUiSheet open={buildOpen} onOpenChange={setBuildOpen} />
    </div>
  );
}

function Message({ message: m, accounts, chat }: { message: UiMessage; accounts: Account[]; chat: UiChat }) {
  const t = useChatT();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  if (m.role === "user") {
    return (
      <div className="flex justify-end">
        <Card tint="lavender" className="max-w-[85%] px-3.5 py-2">
          <Text className="whitespace-pre-wrap">{m.content}</Text>
        </Card>
      </div>
    );
  }
  if (m.error) {
    return <StatusBanner kind="error" title={t("chat.ui.error")} />;
  }
  const canSave = !!m.ui && m.ui.includes("Calculator(");
  const save = async () => {
    setSaving(true);
    try {
      const title = m.content.split("\n")[0].replace(/[*_#`]/g, "").trim().slice(0, 120) || t("chat.tools.kind.custom");
      const tool = await createTool({ title, kind: "custom", spec: m.ui! });
      toast.success(t("chat.ui.saved"), { action: { label: t("chat.tools.open"), onClick: () => router.push(`/app/tools/${tool.id}`) } });
    } catch {
      toast.error(t("chat.ui.saveFailed"));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="flex flex-col gap-2 sm:max-w-[92%]">
      <Card className="px-3.5 py-2.5">
        <RichText>{m.content}</RichText>
        {m.chart && !m.ui ? <AnswerChart chart={m.chart} /> : null}
        {m.draft ? <DraftCard message={m} accounts={accounts} onSave={(i) => chat.saveDraft(m.id, i).catch(() => false)} onDismiss={() => chat.dismissDraft(m.id)} /> : null}
      </Card>
      {m.ui ? <GenerativeUI key={m.ui} spec={m.ui} onAsk={(p) => void chat.send(p)} /> : null}
      <div className="flex items-center gap-1">
        {m.traceId ? (
          <>
            <IconButton
              icon={ThumbsUp}
              label={t("chat.ui.helpful")}
              variant="ghost"
              pressed={m.feedback === 1}
              onClick={() => void chat.rate(m.id, m.traceId!, 1)}
            />
            <IconButton
              icon={ThumbsDown}
              label={t("chat.ui.notHelpful")}
              variant="ghost"
              pressed={m.feedback === 0}
              onClick={() => void chat.rate(m.id, m.traceId!, 0)}
            />
          </>
        ) : null}
        {canSave ? (
          <Button variant="ghost" size="sm" icon={Bookmark} loading={saving} onClick={() => void save()}>
            {t("chat.ui.saveTool")}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
