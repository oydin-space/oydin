import type { TFunction } from "@/i18n/core";
import type { Role } from "@/lib/types";

export const roleLabel = (t: TFunction, r: Role | null | undefined) => (r ? t(`biz.role.${r}`) : "");
export const ROLES: Role[] = ["owner", "accountant", "seller"];
