import { api, post } from "@/lib/api";

export const MODULE_KEYS = ["money", "debts", "people", "suppliers", "warehouse", "schedules"] as const;
export type ModuleKey = (typeof MODULE_KEYS)[number];
export const PRESET_KEYS = ["shop", "services", "creator", "cafe"] as const;
export type PresetKey = (typeof PRESET_KEYS)[number];

export type WidgetKey = "money_summary" | "debts_due" | "people_cost" | "suppliers_due" | "stock_low" | "schedule_week";

export type MetricKey =
  | "money.balance" | "money.income" | "money.expense" | "debts.due" | "debts.overdue" | "people.monthly_cost" | "people.headcount"
  | "suppliers.due" | "suppliers.overdue" | "warehouse.low_stock" | "schedules.upcoming";

export interface WidgetSpec {
  type: "metric" | "list" | "chart";
  source: ModuleKey;
  metric: string; // валидируется сервером; вместе с source даёт MetricKey
  period?: "7d" | "30d" | "90d";
  title?: string;
  limit?: number;
  size?: "s" | "m" | "l";
}
export interface WidgetVersion {
  key: WidgetKey;
  version: number;
  spec: WidgetSpec;
  active: boolean;
  created_at: string;
}
export interface Proposal {
  id: number;
  key: WidgetKey;
  base_version: number;
  spec: WidgetSpec;
  rationale: string;
  status: "pending" | "approved" | "rejected";
  created_at: string;
}
export interface ModulesResponse {
  modules: { key: ModuleKey; enabled: boolean }[];
  presets: { key: PresetKey; modules: ModuleKey[] }[];
}

export const modulesApi = {
  get: () => api<ModulesResponse>("/modules/"),
  set: (modules: Partial<Record<ModuleKey, boolean>>) => api<ModulesResponse>("/modules/", { method: "PUT", body: JSON.stringify({ modules }) }),
  preset: (preset: PresetKey) => post<ModulesResponse>("/modules/preset/", { preset }),
  widgets: () => api<{ widgets: WidgetVersion[] }>("/widgets/").then((r) => r.widgets),
  proposals: () => api<{ proposals: Proposal[] }>("/widgets/proposals/").then((r) => r.proposals),
  propose: () => post<{ created: Proposal[] }>("/widgets/proposals/", {}).then((r) => r.created),
  decide: (id: number, verb: "approve" | "reject") => post<Proposal>(`/widgets/proposals/${id}/${verb}/`, {}),
  versions: (key: WidgetKey) => api<{ versions: WidgetVersion[] }>(`/widgets/${key}/versions/`).then((r) => r.versions),
  rollback: (key: WidgetKey, version: number) => post<WidgetVersion>(`/widgets/${key}/rollback/`, { version }),
};
