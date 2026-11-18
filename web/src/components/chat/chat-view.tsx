"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { StickToBottom } from "use-stick-to-bottom";
import { motion } from "motion/react";
import { Bookmark, Camera, ImagePlus, Settings, ThumbsDown, ThumbsUp, Wand2 } from "lucide-react";
import { PromptBar } from "@/components/ai-chat/prompt-bar";
import { useSession } from "@/components/providers/session-provider";
import { Button, Chip, EmptyState, IconButton, StatusBanner, Text, toast } from "@/components/ui";
import { useApi } from "@/lib/use-api";
import type { Account } from "@/lib/types";
import { createTool } from "@/lib/tools-api";
import { takePendingAttachment } from "@/lib/pending-attachment";
import { useVoiceRecorder } from "@/lib/use-voice-recorder";
import { AnswerChart } from "./answer-chart";
import { BuildUiSheet } from "./build-ui-sheet";
import { TypingBubble } from "./chat-message";
import { fileToDataUrl, pickImage } from "./image-attach";
import { Logo } from "@/components/brand/logo";
import { useChatT } from "./chat-t";
import { DraftCard } from "./draft-card";
import { PersonDraftCard } from "./person-draft-card";
import { GenerativeUI } from "./generative-ui";
import { RichText } from "./rich-text";
import { useUiChat, type UiChat, type UiMessage } from "./use-ui-chat";

const pop = { initial: { opacity: 0, scale: 0.9, y: 10 }, animate: { opacity: 1, scale: 1, y: 0 }, transition: { type: "spring", stiffness: 420, damping: 30, mass: 0.8 } } as const;
const SOURCES = [
  { key: "build", icon: Wand2, action: true },
  { key: "photo", icon: Camera, attach: true },
  { key: "image", icon: ImagePlus, attach: true },
] as const;
const STARTERS = ["chat.ui.p1", "chat.ui.p2", "chat.ui.p3", "chat.ui.p4"] as const;
/** Налоговые подсказки не показываем: расчёт налога — к бухгалтеру, не в быстрые вопросы. */
const TAX_CHIP = /налог|ндс|soliq|qqs|\btax|\bvat\b/i;
/** Одна прокручиваемая строка подсказок: без полосы прокрутки, края мягко гаснут. */
const CHIP_ROW =
  "flex min-w-0 gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [&>*]:shrink-0 [mask-image:linear-gradient(to_right,transparent,black_12px,black_calc(100%-24px),transparent)]";

/** /app/chat: помощник с генеративным UI, голосом, оценкой ответов и сохранением калькуляторов. */
export function ChatView({ lead }: { lead?: ReactNode } = {}) {
  const t = useChatT();
  const { user } = useSession();
  const chat = useUiChat(`${user?.id ?? "anon"}:${user?.active_business_id ?? ""}`);
  const accounts = useApi<{ items: Account[] }>(user?.role === "seller" ? null : "/accounts/");
  const [buildOpen, setBuildOpen] = useState(false);
  const [inject, setInject] = useState<{ items: string[] }>();
  const dictateDone = useRef<(() => void) | null>(null);
  const voice = useVoiceRecorder(
    async (blob) => {
      dictateDone.current?.();
      await chat.sendVoice(blob, t("chat.ui.listening"));
    },
    (kind) => {
      dictateDone.current?.();
      toast.error(kind === "denied" ? t("chat.ui.micDenied") : t("chat.ui.micFailed"));
    },
  );
  const voiceState = useRef(voice.state);
  useEffect(() => {
    voiceState.current = voice.state;
  });

  const attachFile = useCallback(
    async (file: File) => {
      try {
        return await fileToDataUrl(file);
      } catch {
        toast.error(t("chat.ui.imageFailed"));
        return undefined;
      }
    },
    [t],
  );

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("attach") !== "1") return;
    const pending = takePendingAttachment();
    if (!pending) return;
    void attachFile(pending.file).then((url) => url && setInject({ items: [url] }));
  }, [attachFile]);

  if (user?.role === "seller" || chat.block === "forbidden") {
    return (
      <div className="mx-auto w-full max-w-3xl pb-6">
        <EmptyState title={t("chat.ui.sellerTitle")} hint={t("chat.ui.sellerHint")} />
      </div>
    );
  }

  const last = chat.messages.at(-1);
  const chips = (
    last?.role === "assistant" && last.suggestions?.length ? last.suggestions : chat.messages.length ? [] : STARTERS.map((k) => t(k))
  ).filter((s) => !TAX_CHIP.test(s));

  const onDictate = voice.supported
    ? (stop: AbortSignal) => {
        const { promise, resolve } = Promise.withResolvers<undefined>();
        dictateDone.current = () => resolve(undefined);
        // Второй тап в PromptBar = abort: останавливаем запись, только если она ещё идёт.
        stop.addEventListener("abort", () => voiceState.current === "recording" && void voice.toggle(), { once: true });
        void voice.toggle();
        return promise;
      }
    : undefined;

  const consentOff = chat.block === "consent";

  return (
    <div data-fill className="mx-auto flex h-full min-h-0 w-full max-w-[720px] flex-col">
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
          {lead}
          {!chat.messages.length && !lead ? (
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
          {chat.busy ? <TypingBubble /> : null}
          {chips.length && !chat.busy ? (
            <div className={chat.messages.length ? CHIP_ROW : `mt-auto ${CHIP_ROW}`}>
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
        <div className="flex items-center gap-2 [&_.prompt-bar__input]:min-h-11">
          <PromptBar
            disabled={consentOff}
            background="var(--card)"
            color="var(--foreground)"
            sparkColor="#FFD62C"
            width={760}
            busy={chat.busy}
            placeholders={STARTERS.map((k) => t(k))}
            labels={{
              prompt: t("chat.ui.prompt"),
              send: t("chat.send" as never),
              stop: t("chat.ui.stop"),
              dictate: t("chat.ui.dictate"),
              add: t("chat.ui.add"),
              remove: t("chat.ui.removeImage"),
              dictateStop: t("chat.ui.dictateStop"),
              listening: t("chat.ui.recording"),
            }}
            onDictate={onDictate}
            sources={SOURCES.map((s) => ({ ...s, name: t(s.key === "build" ? "chat.build.open" : s.key === "photo" ? "chat.ui.photo" : "chat.ui.attachImage") }))}
            inject={inject}
            onAction={(key) => key === "build" && setBuildOpen(true)}
            onAttach={async (key) => {
              const file = await pickImage(key === "photo" ? "photo" : "screenshot");
              return file ? attachFile(file) : undefined;
            }}
            onSend={(text, d) => {
              const images = d.attachments.filter((a) => a.startsWith("data:image"));
              void chat.send(text || (images.length ? t("chat.ui.photoDefault") : ""), images);
            }}
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
      <motion.div className="flex origin-bottom-right justify-end pr-2" {...pop}>
        <div className="tail-r flex max-w-[82%] flex-col gap-2 rounded-[1.25rem] bg-brand px-3.5 py-2 text-[#3b342a]">
          {m.images?.length ? (
            <div className="flex flex-wrap gap-2">
              {m.images.map((src, i) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={i} src={src} alt="" className="max-h-40 rounded-xl object-cover" />
              ))}
            </div>
          ) : null}
          <p className="whitespace-pre-wrap text-[1rem] leading-snug">{m.content}</p>
        </div>
      </motion.div>
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
    <motion.div className="flex origin-bottom-left flex-col gap-2 pl-2 sm:max-w-[92%]" {...pop}>
      <div className="tail-l rounded-[1.25rem] border border-border bg-card px-3.5 py-2.5 shadow-sm">
        <RichText>{m.content}</RichText>
        {m.chart && !m.ui ? <AnswerChart chart={m.chart} /> : null}
        {m.personDraft ? <PersonDraftCard draft={m.personDraft} state={m.personDraftState ?? "pending"} onConfirm={() => chat.confirmPerson(m.id, m.personDraft!)} onDismiss={() => chat.dismissPerson(m.id)} /> : null}
        {m.draft ? <DraftCard message={m} accounts={accounts} onSave={(i) => chat.saveDraft(m.id, i)} onDismiss={() => chat.dismissDraft(m.id)} /> : null}
      </div>
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
    </motion.div>
  );
}
