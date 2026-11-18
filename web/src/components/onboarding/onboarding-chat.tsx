"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Send } from "lucide-react";
import { useLocale, useT, type Key } from "@/i18n";
import { Logo } from "@/components/brand/logo";
import { useSession } from "@/components/providers/session-provider";
import { Card, IconButton, Input, LanguageSwitcher, ProgressBar, SkeletonCard, SkeletonText, Text } from "@/components/ui";
import { ACT_TWO, getState, sendMessage, skipStep, STEPS, submitStep, type LookupResult, type OnboardingState, type Step } from "./api";
import {
  ActivityCard,
  BusinessCard,
  ConsentCard,
  ContactCard,
  errorText,
  InstallCard,
  InviteCard,
  NameCard,
  PlanResult,
  SummaryCard,
  TagsCard,
  TourCard,
  UploadCard,
  type Submit,
} from "./cards";

const CHAT_STEPS: readonly Step[] = ["name", "contact", "business", "activity", "pains", "goals", "tour"];

type Bubble = { id: number; from: "user" | "assistant"; text: string };

function AssistantBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex max-w-[88%] items-end gap-2 self-start">
      <Logo size={28} className="shrink-0" />
      <Card className="rounded-bl-md px-4 py-3">{children}</Card>
    </div>
  );
}

function UserBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="max-w-[80%] self-end rounded-card rounded-br-md bg-primary px-4 py-3 text-primary-foreground">
      <Text variant="secondary" tone="inherit">
        {children}
      </Text>
    </div>
  );
}

export function OnboardingChat({ onUnavailable }: { onUnavailable: () => void }) {
  const t = useT();
  const [locale] = useLocale();
  const router = useRouter();
  const { refresh } = useSession();
  const [state, setState] = useState<OnboardingState | null>(null);
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [bubbles, setBubbles] = useState<Bubble[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getState()
      .then((s) => (s.done ? router.replace("/app") : setState(s)))
      .catch(onUnavailable);
  }, [router, onUnavailable]);

  const step = state?.step ?? null;
  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [step, bubbles.length, lookup]);

  if (!state || !step) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-col gap-4 px-4 pt-6">
        <SkeletonText lines={2} />
        <SkeletonCard />
        <SkeletonCard />
      </main>
    );
  }

  const advance = (next: OnboardingState) => {
    setState(next);
    setBubbles([]);
    setLookup(null);
  };
  const submit: Submit = async (value) => advance(await submitStep(step, value));
  const skip = async () => advance(await skipStep(step));
  const finish = async () => {
    await submitStep("summary", {});
    await refresh();
    router.replace("/app");
  };

  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText("");
    setSending(true);
    const id = Date.now();
    setBubbles((b) => [...b, { id, from: "user", text: body }]);
    try {
      const reply = await sendMessage(step, body, locale);
      const say = reply.say ?? (reply.say_key ? t(reply.say_key as Key) : "");
      if (reply.state.step !== step) advance(reply.state);
      else setState(reply.state);
      if (reply.lookup) setLookup(reply.lookup);
      if (say) setBubbles((b) => [...b, { id: id + 1, from: "assistant", text: say }]);
    } catch (e) {
      setBubbles((b) => [...b, { id: id + 1, from: "assistant", text: errorText(t, e) }]);
    } finally {
      setSending(false);
    }
  };

  const steps = state.steps ?? {};
  const visible = STEPS.filter((s) => steps[s] !== undefined);
  const past = visible.filter((s) => s !== step && (steps[s] === "done" || steps[s] === "skipped") && STEPS.indexOf(s) < STEPS.indexOf(step));
  const progress = state.progress ?? { done: 0, total: STEPS.length };
  const plan = state.answers?.activity?.plan;
  const name = state.prefill?.first_name;

  const widget: Record<Step, React.ReactNode> = {
    consent: <ConsentCard onSubmit={submit} />,
    name: <NameCard state={state} onSubmit={submit} />,
    contact: <ContactCard state={state} onSubmit={submit} onSkip={skip} />,
    business: <BusinessCard state={state} lookup={lookup} setLookup={setLookup} onSubmit={submit} />,
    activity: <ActivityCard state={state} onSubmit={submit} onSkip={skip} />,
    pains: <TagsCard kind="pains" onSubmit={submit} onSkip={skip} />,
    goals: <TagsCard kind="goals" onSubmit={submit} onSkip={skip} />,
    upload: <UploadCard state={state} onSubmit={submit} onSkip={skip} />,
    invite: <InviteCard state={state} onSubmit={submit} onSkip={skip} />,
    install: <InstallCard onSubmit={submit} />,
    tour: <TourCard state={state} onSubmit={submit} onSkip={skip} />,
    summary: <SummaryCard onFinish={finish} />,
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="glass-liquid sticky top-0 z-20 px-4 pb-3 pt-[max(env(safe-area-inset-top),0.75rem)]">
        <div className="mx-auto flex w-full max-w-lg flex-col gap-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Logo size={32} />
              <Text variant="caption" tone="muted">
                {t(ACT_TWO.includes(step) ? "onboarding.act2" : "onboarding.act1")}
              </Text>
            </div>
            <LanguageSwitcher />
          </div>
          <ProgressBar value={(progress.done / Math.max(progress.total, 1)) * 100} label={t("onboarding.progress", progress)} />
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-lg flex-1 flex-col gap-3 px-4 py-4" aria-live="polite">
        {past.map((s) => (
          <div key={s} className="flex flex-col gap-2 opacity-70">
            <AssistantBubble>
              <Text variant="secondary">{t(`onboarding.ask.${s}` as Key, { name: name ?? "" })}</Text>
            </AssistantBubble>
            <UserBubble>{t(steps[s] === "skipped" ? "onboarding.answer.skipped" : "onboarding.answer.done")}</UserBubble>
          </div>
        ))}

        {plan && step !== "activity" && STEPS.indexOf(step) > STEPS.indexOf("activity") && step !== "summary" ? <PlanResult plan={plan} /> : null}

        <AssistantBubble>
          <Text variant="body">{t(`onboarding.ask.${step}` as Key, { name: name ?? "" })}</Text>
        </AssistantBubble>
        {widget[step]}

        {bubbles.map((b) =>
          b.from === "user" ? (
            <UserBubble key={b.id}>{b.text}</UserBubble>
          ) : (
            <AssistantBubble key={b.id}>
              <Text variant="secondary">{b.text}</Text>
            </AssistantBubble>
          ),
        )}
        <div ref={end} />
      </main>

      {CHAT_STEPS.includes(step) ? (
        <form
          className="glass-liquid sticky bottom-0 z-20 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <div className="mx-auto flex w-full max-w-lg items-end gap-2">
            <Input
              className="flex-1"
              label={t("onboarding.composer")}
              placeholder={t("onboarding.composerPlaceholder")}
              value={text}
              maxLength={1000}
              onChange={(e) => setText(e.target.value)}
              disabled={sending}
            />
            <IconButton icon={Send} label={t("onboarding.send")} type="submit" disabled={sending || !text.trim()} />
          </div>
        </form>
      ) : null}
    </div>
  );
}
