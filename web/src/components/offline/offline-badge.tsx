"use client";

import Link from "next/link";
import { CloudUpload, Loader2, WifiOff } from "lucide-react";
import { Badge, Icon } from "@/components/ui";
import { useOfflineQueue } from "@/lib/offline/sync";
import { useOfflineT } from "./use-offline-t";

/** Значок состояния связи для шапки: «Без сети», «К отправке: N», «Отправляем…». Пусто, когда всё синхронизировано. Тоже запускает автосинхронизацию. */
export function OfflineBadge() {
  const t = useOfflineT();
  const { online, pending, syncing } = useOfflineQueue();
  if (online && !pending && !syncing) return null;

  const label = !online ? t("offline.badge.offline") : syncing ? t("offline.badge.syncing") : t("offline.badge.pending", { count: pending });
  const glyph = !online ? WifiOff : syncing ? Loader2 : CloudUpload;
  return (
    <Link href="/app/quick" aria-label={`${label}. ${t("offline.badge.open")}`} className="focus-ring min-target inline-flex items-center rounded-pill">
      <Badge tone={online ? "caution" : "negative"} icon={<Icon icon={glyph} size={16} className={syncing && online ? "animate-spin" : undefined} />}>
        {!online && pending ? `${label} · ${pending}` : label}
      </Badge>
    </Link>
  );
}
