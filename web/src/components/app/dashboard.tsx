"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ChatDock } from "@/components/chat/chat-dock";
import { ChatPanel } from "@/components/chat/chat-panel";
import { InsightsSection, PulseSection, PulseSkeleton } from "@/components/pulse/pulse-section";
import { SummaryStrip } from "@/components/pulse/summary-strip";
import { ErrorState } from "@/components/shared/states";
import { useApi } from "@/lib/use-api";
import { useChat } from "@/lib/use-chat";
import type { Account, Insight, Pulse } from "@/lib/types";

const fade = { initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.22 } };

export function Dashboard() {
  const pulse = useApi<Pulse>("/dashboard/pulse/");
  const insights = useApi<{ items: Insight[] }>("/insights/");
  const accounts = useApi<{ items: Account[] }>("/accounts/");
  const [open, setOpen] = useState(false);
  const chat = useChat({ onSaved: pulse.reload });

  return (
    <div data-fill className="mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-2">
      <motion.div layout className={open ? "shrink-0" : "min-h-0 flex-1 overflow-y-auto pb-2"}>
        <AnimatePresence mode="wait" initial={false}>
          {pulse.loading && !pulse.data ? (
            <motion.div key="sk" {...fade}><PulseSkeleton /></motion.div>
          ) : pulse.error || !pulse.data ? (
            <motion.div key="err" {...fade}><ErrorState message={pulse.error ?? "нет данных"} onRetry={pulse.reload} /></motion.div>
          ) : open ? (
            <motion.div key="strip" {...fade}><SummaryStrip pulse={pulse.data} onExpand={() => setOpen(false)} /></motion.div>
          ) : (
            <motion.div key="full" {...fade} className="space-y-4">
              <PulseSection pulse={pulse.data} />
              <InsightsSection items={insights.data?.items ?? []} onAsk={(q) => { setOpen(true); void chat.send(q); }} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div key="chat" layout className="flex min-h-0 flex-1 flex-col" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ChatPanel chat={chat} accounts={accounts.data?.items ?? []} />
          </motion.div>
        ) : null}
      </AnimatePresence>
      <ChatDock chat={chat} onOpen={() => setOpen(true)} />
    </div>
  );
}
