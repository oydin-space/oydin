"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import { Button, IconButton, Input, PageHeader, Sheet, SkeletonCard, StateView, toast } from "@/components/ui";
import { useChatT } from "@/components/chat/chat-t";
import { GenerativeUI } from "@/components/chat/generative-ui";
import { useApi } from "@/lib/use-api";
import { deleteTool, updateTool, type SavedTool } from "@/lib/tools-api";

/** /app/tools/[id]: живой калькулятор; значения сохраняются с задержкой. */
export function ToolDetail({ id }: { id: number }) {
  const t = useChatT();
  const router = useRouter();
  const res = useApi<SavedTool>(Number.isFinite(id) ? `/tools/${id}/` : null);
  // Локальная копия появляется после первой правки; до неё показываем ответ сервера.
  const [local, setTool] = useState<SavedTool | null>(null);
  const tool = local ?? res.data ?? null;
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [working, setWorking] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => () => clearTimeout(timer.current), []);

  const onValues = (values: Record<string, number>) => {
    setTool({ ...tool!, values });
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void updateTool(id, { values }).catch(() => toast.error(t("chat.ui.saveFailed"))), 600);
  };

  const patch = async (body: Partial<Pick<SavedTool, "title" | "pinned">>) => {
    setWorking(true);
    try {
      setTool(await updateTool(id, body));
      return true;
    } catch {
      toast.error(t("chat.ui.saveFailed"));
      return false;
    } finally {
      setWorking(false);
    }
  };

  const remove = async () => {
    setWorking(true);
    try {
      await deleteTool(id);
      toast.success(t("chat.tools.deleted"));
      router.push("/app/tools");
    } catch {
      toast.error(t("chat.ui.error"));
      setWorking(false);
    }
  };

  const status = !Number.isFinite(id) || res.error === "not_found" ? "empty" : res.error ? "error" : !tool ? "loading" : "ready";

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 pb-6">
      <Button asChild variant="ghost" size="sm" icon={ArrowLeft} className="self-start">
        <Link href="/app/tools">{t("chat.tools.back")}</Link>
      </Button>
      <StateView
        status={status}
        error={res.error === "forbidden" ? t("chat.tools.forbidden") : t("chat.tools.loadError")}
        onRetry={res.reload}
        empty={{ title: t("chat.tools.notFound") }}
        skeleton={<SkeletonCard />}
      >
        {tool ? (
          <>
            <PageHeader
              title={tool.title}
              hint={t(`chat.tools.kind.${tool.kind}`)}
              actions={
                <div className="flex gap-1">
                  <IconButton
                    icon={tool.pinned ? PinOff : Pin}
                    label={tool.pinned ? t("chat.tools.unpin") : t("chat.tools.pin")}
                    pressed={tool.pinned}
                    variant="ghost"
                    onClick={() => void patch({ pinned: !tool.pinned })}
                  />
                  <IconButton
                    icon={Pencil}
                    label={t("chat.tools.rename")}
                    variant="ghost"
                    onClick={() => {
                      setName(tool.title);
                      setRenaming(true);
                    }}
                  />
                  <IconButton icon={Trash2} label={t("chat.tools.delete")} variant="ghost" onClick={() => setConfirm(true)} />
                </div>
              }
            />
            <GenerativeUI key={tool.spec} spec={tool.spec} values={tool.values} onValuesChange={onValues} />
          </>
        ) : null}
      </StateView>

      <Sheet
        open={renaming}
        onOpenChange={setRenaming}
        title={t("chat.tools.rename")}
        footer={
          <Button
            block
            loading={working}
            disabled={!name.trim()}
            onClick={async () => {
              if (await patch({ title: name.trim().slice(0, 120) })) setRenaming(false);
            }}
          >
            {t("chat.tools.save")}
          </Button>
        }
      >
        <Input label={t("chat.tools.name")} value={name} maxLength={120} onChange={(e) => setName(e.target.value)} />
      </Sheet>

      <Sheet
        open={confirm}
        onOpenChange={setConfirm}
        variant="dialog"
        title={t("chat.tools.deleteConfirm")}
        description={t("chat.tools.deleteHint")}
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setConfirm(false)}>
              {t("chat.tools.cancel")}
            </Button>
            <Button variant="destructive" loading={working} onClick={() => void remove()}>
              {t("chat.tools.delete")}
            </Button>
          </div>
        }
      >
        {null}
      </Sheet>
    </div>
  );
}
