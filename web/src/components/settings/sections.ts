import type { Role } from "@/lib/types";
import type { SKey } from "./use-st";

export type SectionId = "profile" | "privacy" | "accounts" | "integrations" | "notifications" | "data" | "sharing" | "developer";

const ALL: Role[] = ["owner", "accountant", "seller"];
const OFFICE: Role[] = ["owner", "accountant"];

export const SECTIONS: { id: SectionId; path: string; label: SKey; roles: Role[] }[] = [
  { id: "profile", path: "/app/settings", label: "settings.nav.profile", roles: ALL },
  { id: "privacy", path: "/app/settings/privacy", label: "settings.nav.privacy", roles: OFFICE },
  { id: "accounts", path: "/app/settings/accounts", label: "settings.nav.accounts", roles: OFFICE },
  { id: "integrations", path: "/app/settings/integrations", label: "settings.nav.integrations", roles: OFFICE },
  { id: "notifications", path: "/app/settings/notifications", label: "settings.nav.notifications", roles: OFFICE },
  { id: "data", path: "/app/settings/data", label: "settings.nav.data", roles: OFFICE },
  { id: "sharing", path: "/app/settings/sharing", label: "settings.nav.sharing", roles: ["owner"] },
  { id: "developer", path: "/app/settings/developer", label: "settings.nav.developer", roles: ["owner"] },
];
