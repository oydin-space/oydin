"use client";

import { ExternalLink, RefreshCw, Send, Unlink } from "lucide-react";
import { useState } from "react";
import { Button, Dialog, FeedbackNotice } from "@/components/ui";
import { startTelegramLink, type TelegramLink, unlinkTelegram } from "@/lib/settings-api";
import { ResourceGate } from "./resource-gate";
import { useST } from "./use-st";

export function TelegramDialog({
  open,
  onOpenChange,
  state,
  loading,
  error,
  reload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: TelegramLink | null;
  loading: boolean;
  error: unknown;
  reload: () => void;
}) {
  const { t, err } = useST();
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setProblem(null);
    try {
      await action();
    } catch (x) {
      setProblem(err(x));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={t("settings.telegram.title")} description={t("settings.telegram.desc")} closeLabel={t("settings.common.close")}>
      <ResourceGate loading={loading} error={error} onRetry={reload}>
        <div className="flex flex-col gap-3">
          {state?.linked ? (
            <>
              <FeedbackNotice>{state.username ? t("settings.telegram.linked", { username: state.username }) : t("settings.telegram.linkedAnon")}</FeedbackNotice>
              <Button
                variant="destructive"
                icon={Unlink}
                loading={busy}
                onClick={() =>
                  run(async () => {
                    await unlinkTelegram();
                    setUrl(null);
                    reload();
                  })
                }
              >
                {t("settings.telegram.unlink")}
              </Button>
            </>
          ) : url ? (
            <>
              <p className="text-small text-muted-foreground">{t("settings.telegram.openHint")}</p>
              <Button asChild icon={ExternalLink}>
                <a href={url} target="_blank" rel="noopener noreferrer">
                  {t("settings.telegram.open")}
                </a>
              </Button>
              <Button variant="secondary" icon={RefreshCw} loading={busy} onClick={() => run(async () => reload())}>
                {t("settings.telegram.check")}
              </Button>
            </>
          ) : (
            <Button
              icon={Send}
              loading={busy}
              onClick={() =>
                run(async () => {
                  setUrl((await startTelegramLink()).url);
                })
              }
            >
              {t("settings.telegram.connect")}
            </Button>
          )}
          {problem ? <FeedbackNotice kind="error">{problem}</FeedbackNotice> : null}
        </div>
      </ResourceGate>
    </Dialog>
  );
}
