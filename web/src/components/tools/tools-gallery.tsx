"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bookmark, Calculator, Eye, Pin, PinOff, Wrench } from "lucide-react";
import { Badge, Button, Card, Icon, IconButton, Input, ListGroup, ListRow, PAGE_WIDTH, PageHeader, Section, Sheet, SkeletonCard, SkeletonList, StateView, toast } from "@/components/ui";
import { useChatT } from "@/components/chat/chat-t";
import { useI18n } from "@/i18n";
import { ApiError } from "@/lib/api";
import { useApi } from "@/lib/use-api";
import { createTool, generateTool, updateTool, type SavedTool, type ToolTemplate } from "@/lib/tools-api";
import { GenerativeUI } from "@/components/chat/generative-ui";

/** /app/tools: шаблоны калькуляторов, генерация по запросу и сохранённые инструменты. */
export function ToolsGallery() {
  const t = useChatT();
  const { locale } = useI18n();
  const router = useRouter();
  const templates = useApi<ToolTemplate[]>(`/tools/templates/?lang=${locale}`);
  const saved = useApi<SavedTool[]>("/tools/");
  const [busy, setBusy] = useState<string | null>(null);
  const [prompt, setPrompt] = useState("");
  const [preview, setPreview] = useState<ToolTemplate | null>(null);
  const [previewValues, setPreviewValues] = useState<Record<string, number>>({});

  const openPreview = (tpl: ToolTemplate) => {
    setPreviewValues({});
    setPreview(tpl);
  };

  const forbidden = saved.error === "forbidden" || templates.error === "forbidden";

  const save = async (tpl: ToolTemplate) => {
    setBusy(tpl.kind);
    try {
      const tool = await createTool({ title: tpl.title, kind: tpl.kind, spec: tpl.spec });
      router.push(`/app/tools/${tool.id}`);
    } catch {
      toast.error(t("chat.ui.saveFailed"));
      setBusy(null);
    }
  };

  const generate = async () => {
    const text = prompt.trim();
    if (!text) return;
    setBusy("generate");
    try {
      await save(await generateTool({ prompt: text, lang: locale }));
    } catch (e) {
      toast.error(e instanceof ApiError && e.message === "unsupported_kind" ? t("chat.tools.unsupported") : t("chat.build.err.error"));
      setBusy(null);
    }
  };

  const togglePin = async (tool: SavedTool) => {
    try {
      await updateTool(tool.id, { pinned: !tool.pinned });
      saved.reload();
    } catch {
      toast.error(t("chat.tools.loadError"));
    }
  };

  /** Тип показываем только если он не повторяет название. */
  const kindHint = (x: ToolTemplate) => {
    const kind = t(`chat.tools.kind.${x.kind}`);
    return kind.trim().toLowerCase() === x.title.trim().toLowerCase() ? undefined : kind;
  };

  if (forbidden) {
    return (
      <div className={`${PAGE_WIDTH} pb-6`}>
        <StateView status="empty" empty={{ title: t("chat.tools.forbidden") }}>
          {null}
        </StateView>
      </div>
    );
  }

  const items = [...(saved.data ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned));

  return (
    <div className={`${PAGE_WIDTH} flex flex-col gap-6 pb-6`}>
      <PageHeader title={t("chat.tools.title")} hint={t("chat.tools.hint")} />

      <Card>
        <form
          className="flex flex-col gap-2 sm:flex-row sm:items-end"
          onSubmit={(e) => {
            e.preventDefault();
            void generate();
          }}
        >
          <Input
            className="flex-1"
            label={t("chat.tools.generate")}
            placeholder={t("chat.tools.generatePlaceholder")}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
          <Button type="submit" icon={Wrench} loading={busy === "generate"} disabled={!prompt.trim() || !!busy}>
            {busy === "generate" ? t("chat.tools.generating") : t("chat.tools.generate")}
          </Button>
        </form>
      </Card>

      <Section title={t("chat.tools.saved")}>
        <StateView
          status={saved.loading ? "loading" : saved.error ? "error" : items.length ? "ready" : "empty"}
          error={t("chat.tools.loadError")}
          onRetry={saved.reload}
          empty={{ title: t("chat.tools.savedEmpty"), hint: t("chat.tools.savedEmptyHint") }}
          skeleton={<SkeletonList />}
        >
          <ListGroup>
            {items.map((tool) => (
              <ListRow
                key={tool.id}
                title={tool.title}
                subtitle={kindHint(tool)}
                leading={<Icon icon={Calculator} />}
                href={`/app/tools/${tool.id}`}
                trailing={
                  <IconButton
                    icon={tool.pinned ? PinOff : Pin}
                    label={tool.pinned ? t("chat.tools.unpin") : t("chat.tools.pin")}
                    pressed={tool.pinned}
                    variant="ghost"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      void togglePin(tool);
                    }}
                  />
                }
                status={tool.pinned ? <Badge tone="neutral" icon={<Icon icon={Pin} size={16} />}>{t("chat.tools.pinned")}</Badge> : undefined}
              />
            ))}
          </ListGroup>
        </StateView>
      </Section>

      <Section title={t("chat.tools.templates")}>
        <StateView
          status={templates.loading ? "loading" : templates.error ? "error" : "ready"}
          error={t("chat.tools.loadError")}
          onRetry={templates.reload}
          skeleton={
            <div className="grid gap-3 sm:grid-cols-2">
              <SkeletonCard />
              <SkeletonCard />
            </div>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {(templates.data ?? []).map((tpl) => (
              <Card
                key={tpl.kind}
                title={tpl.title}
                description={kindHint(tpl)}
                footer={
                  <div className="flex flex-wrap gap-2">
                    <Button variant="ghost" size="sm" icon={Eye} disabled={!!busy} onClick={() => openPreview(tpl)}>
                      {t("chat.tools.open")}
                    </Button>
                    <Button variant="secondary" size="sm" icon={Bookmark} loading={busy === tpl.kind} disabled={!!busy} onClick={() => void save(tpl)}>
                      {t("chat.tools.save")}
                    </Button>
                  </div>
                }
              />
            ))}
          </div>
        </StateView>
      </Section>

      <Sheet
        open={!!preview}
        onOpenChange={(open) => !open && setPreview(null)}
        title={preview?.title ?? ""}
        description={preview ? kindHint(preview) : undefined}
        footer={
          <Button block icon={Bookmark} loading={!!preview && busy === preview.kind} disabled={!!busy} onClick={() => preview && void save(preview)}>
            {t("chat.tools.save")}
          </Button>
        }
      >
        {preview ? <GenerativeUI key={preview.spec} spec={preview.spec} values={previewValues} onValuesChange={setPreviewValues} /> : null}
      </Sheet>
    </div>
  );
}
