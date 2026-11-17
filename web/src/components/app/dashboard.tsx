"use client";

import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { ChatDock } from "@/components/chat/chat-dock";
import { ChatPanel } from "@/components/chat/chat-panel";
import { InsightsSection, PulseSection, PulseSkeleton } from "@/components/pulse/pulse-section";
import { SummaryStrip } from "@/components/pulse/summary-strip";
import { ErrorState } from "@/components/shared/states";
import { bindBackButton, haptic } from "@/lib/telegram";
import { useApi } from "@/lib/use-api";
import { useChat } from "@/lib/use-chat";
import type { Account, Insight, Pulse } from "@/lib/types";

const spring = { type: "spring", stiffness: 380, damping: 36 } as const;
const fade = { initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.22 } };

export function Dashboard() {
  const pulse = useApi<Pulse>("/dashboard/pulse/");
  const insights = useApi<{ items: Insight[] }>("/insights/");
  const accounts = useApi<{ items: Account[] }>("/accounts/");
  const [open, setOpen] = useState(false);
  const chat = useChat({ onSaved: pulse.reload });

  const openChat = useCallback(() => {
    setOpen((o) => {
      if (!o) {
        haptic("tap");
        window.history.pushState({ chat: true }, "");
      }
      return true;
    });
  }, []);
  const closeChat = useCallback(() => {
    setOpen((o) => {
      if (o && window.history.state?.chat) window.history.back();
      return false;
    });
  }, []);
  // Жест «назад», Esc и кнопка Telegram сворачивают чат
  useEffect(() => {
    if (!open) return;
    const onPop = () => setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeChat();
    window.addEventListener("popstate", onPop);
    window.addEventListener("keydown", onKey);
    const unbind = bindBackButton(closeChat);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("keydown", onKey);
      unbind();
    };
  }, [open, closeChat]);

  return (
    <div data-fill className="mx-auto flex h-full min-h-0 w-full max-w-5xl flex-col gap-2">
      <motion.div layout transition={spring} className={open ? "shrink-0 pt-1" : "no-scrollbar min-h-0 flex-1 overflow-y-auto pb-2 pt-1"}>
        <AnimatePresence mode="wait" initial={false}>
          {pulse.loading && !pulse.data ? (
            <motion.div key="sk" {...fade}><PulseSkeleton /></motion.div>
          ) : pulse.error || !pulse.data ? (
            <motion.div key="err" {...fade}><ErrorState message={pulse.error ?? "нет данных"} onRetry={pulse.reload} /></motion.div>
          ) : open ? (
            <motion.div key="strip" {...fade}><SummaryStrip pulse={pulse.data} onExpand={closeChat} /></motion.div>
          ) : (
            <motion.div key="full" {...fade} className="space-y-5">
              <header className="px-1 pt-1">
                <h1 className="text-[2rem] font-bold leading-tight tracking-tight">Пульс</h1>
                <p className="text-sm text-muted-foreground">Как дела у бизнеса сегодня</p>
              </header>
              <PulseSection pulse={pulse.data} />
              <InsightsSection items={insights.data?.items ?? []} onAsk={(q) => { openChat(); void chat.send(q); }} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div key="chat" layout transition={spring} className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}>
            <ChatPanel chat={chat} accounts={accounts.data?.items ?? []} />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <ChatDock chat={chat} onOpen={openChat} />
    </div>
  );
}
