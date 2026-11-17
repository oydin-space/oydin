"use client";

import { useSession } from "@/components/providers/session-provider";
import { EmptyState, SkeletonList } from "@/components/ui";
import { SECTIONS, type SectionId } from "./sections";
import { useST } from "./use-st";

/** Пускает в раздел только разрешённые роли; остальные видят пояснение вместо 403 от сервера. */
export function SectionGate({ id, children }: { id: SectionId; children: React.ReactNode }) {
  const { t } = useST();
  const { user } = useSession();
  if (!user) return <SkeletonList rows={3} />;
  const section = SECTIONS.find((s) => s.id === id);
  const role = user.role;
  if (!role || !section?.roles.includes(role)) {
    return <EmptyState title={t("settings.forbidden.title")} hint={t("settings.forbidden.ownerOnly")} />;
  }
  return <>{children}</>;
}
