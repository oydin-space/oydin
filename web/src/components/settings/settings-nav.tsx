"use client";

import { Bell, Code2, Database, Link2, Plug, ShieldCheck, User, Wallet, type LucideIcon } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useSession } from "@/components/providers/session-provider";
import { Chip, Icon } from "@/components/ui";
import { SECTIONS, type SectionId } from "./sections";
import { useST } from "./use-st";

const ICONS: Record<SectionId, LucideIcon> = { profile: User, privacy: ShieldCheck, accounts: Wallet, integrations: Plug, notifications: Bell, data: Database, sharing: Link2, developer: Code2 };

export function SettingsNav() {
  const { t } = useST();
  const { user } = useSession();
  const path = usePathname().replace(/\/$/, "");
  const router = useRouter();
  const items = SECTIONS.filter((s) => user && user.role && s.roles.includes(user.role));
  if (items.length < 2) return null;
  return (
    <nav aria-label={t("settings.nav.aria")} className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0 [&>*]:shrink-0 [&>*]:whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {items.map((s) => (
        <Chip key={s.id} selected={path === s.path} onSelect={() => router.push(s.path)}>
          <span className="inline-flex items-center gap-1.5"><Icon icon={ICONS[s.id]} size={16} />{t(s.label)}</span>
        </Chip>
      ))}
    </nav>
  );
}
