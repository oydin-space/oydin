"use client";

import { useState } from "react";
import { Bookmark, Pin, Sparkles } from "lucide-react";
import { Button, Sheet, StatusBanner, Textarea, toast } from "@/components/ui";
import { ApiError } from "@/lib/api";
import { useI18n } from "@/i18n";
import { createTool, generateTool, type ToolTemplate } from "@/lib/tools-api";
import { useChatT, type ChatKey } from "./chat-t";
import { GenerativeUI } from "./generative-ui";

const KNOWN_ERRORS = ["invalid", "unsupported_kind", "ai_unavailable", "forbidden"];

/** Режим «Построить»: описание → POST /ai/tools/generate/ → превью OpenUI → сохранить / закрепить в /tools/. */
export function BuildUiSheet({ open, onOpenChange, onSaved }: { open: boolean; onOpenChange: (open: boolean) => void; onSaved?: (id: number) => void }) {
  const t = useChatT();
  const { locale } = useI18n();
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ToolTemplate | null>(null);

  const build = async () => {
    const text = prompt.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      setResult(await generateTool({ prompt: text, lang: locale }));
    } catch (e) {
      setResult(null);
      const code = e instanceof ApiError ? e.message : "";
      setError(t(`chat.build.err.${KNOWN_ERRORS.includes(code) ? code : "error"}` as ChatKey));
    } finally {
      setBusy(false);
    }
  };

  const save = async (pinned: boolean) => {
    if (!result) return;
    setSaving(true);
    try {
      const tool = await createTool({ title: result.title, kind: result.kind, spec: result.spec, pinned });
      toast.success(t("chat.build.saved"));
      onSaved?.(tool.id);
      onOpenChange(false);
      setResult(null);
      setPrompt("");
    } catch {
      toast.error(t("chat.ui.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange} title={t("chat.build.title")} description={t("chat.build.hint")}>
      <div className="flex flex-col gap-3">
        <Textarea
          label={t("chat.build.title")}
          placeholder={t("chat.build.placeholder")}
          value={prompt}
          maxLength={1000}
          rows={3}
          onChange={(e) => setPrompt(e.target.value)}
        />
        {error ? <StatusBanner kind="error" title={error} /> : null}
        <Button icon={Sparkles} loading={busy} disabled={!prompt.trim()} onClick={() => void build()}>
          {result ? t("chat.build.again") : t("chat.build.submit")}
        </Button>
        {result ? (
          <div className="flex flex-col gap-3">
            <GenerativeUI key={result.spec} spec={result.spec} />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" icon={Bookmark} loading={saving} onClick={() => void save(false)}>
                {t("chat.build.save")}
              </Button>
              <Button icon={Pin} loading={saving} onClick={() => void save(true)}>
                {t("chat.build.savePin")}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
