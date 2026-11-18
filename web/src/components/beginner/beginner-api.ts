import { api } from "@/lib/api";

export type ItemKind = "one_off" | "monthly";
export interface BudgetItem {
  name: string;
  kind: ItemKind;
  amount: number;
}
export interface Breakeven {
  price: number | null;
  unit_cost: number | null;
  fixed_monthly: number | null;
}
export type Regime = "" | "self_employed" | "yatt" | "mchj";
export type StepId = "budget" | "breakeven" | "form" | "register" | "bank" | "soliq";
export const STEPS: StepId[] = ["budget", "breakeven", "form", "register", "bank", "soliq"];

export interface Registration {
  columns: { form: string; who: string; liability: string; staff: string; where: string };
  forms: { id: Exclude<Regime, "">; name: string; who: string; liability: string; staff: string; where: string }[];
  disclaimer: string;
  sources_title: string;
  sources: { url: string; label: string }[];
}

export interface BeginnerPlan {
  budget_items: BudgetItem[];
  totals: { one_off: number; monthly: number };
  breakeven: Breakeven;
  breakeven_result: { margin: number | null; units: number | null; revenue: number | null };
  checklist: StepId[];
  regime: Regime;
  registration: Registration;
}

export type PlanDraft = Pick<BeginnerPlan, "budget_items" | "breakeven" | "checklist" | "regime">;

const lang = () => (typeof document === "undefined" ? "ru" : document.documentElement.lang || "ru");

export const beginnerApi = {
  get: () => api<BeginnerPlan>(`/beginner/plan/?lang=${lang()}`),
  save: (draft: PlanDraft) => api<BeginnerPlan>(`/beginner/plan/?lang=${lang()}`, { method: "PUT", body: JSON.stringify(draft) }),
  pdfUrl: () => `/api/beginner/plan/pdf/?lang=${lang()}`,
};
