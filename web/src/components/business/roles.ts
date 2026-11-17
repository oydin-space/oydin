import type { Role } from "@/lib/types";

const strings: Record<Role, string> = { owner: "Владелец", accountant: "Бухгалтер", seller: "Продавец" };

export const roleLabel = (r: Role | null | undefined) => (r ? strings[r] : "");
export const ROLES: Role[] = ["owner", "accountant", "seller"];
