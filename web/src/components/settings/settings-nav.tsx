"use client";

import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/components/providers/session-provider";
import { Chip } from "@/components/ui";
import { SECTIONS } from "./sections";
import { useST } from "./use-st";

export function SettingsNav() {
  const { t } = useST();
  const { user } = useSession();
  const path = usePathname().replace(/\/$/, "");
  const router = useRouter();
  const items = SECTIONS.filter((s) => user && user.role && s.roles.includes(user.role));
  if (items.length < 2) return null;
  return (
    <nav aria-label={t("settings.nav.aria")} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
      {items.map((s) => (
        <Chip key={s.id} selected={path === s.path} onSelect={() => router.push(s.path)}>
          {t(s.label)}
        </Chip>
      ))}
    </nav>
  );
}
