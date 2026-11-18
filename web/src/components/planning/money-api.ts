import { api, post } from "@/lib/api";

export type MoneyVerdict = "yes" | "risky" | "no";

export interface SplitItem {
  kind: string;
  title: string;
  date: string | null;
  amount: number;
  overdue: boolean;
}

export interface OwnerSplitData {
  as_of: string;
  horizon_days: number;
  balance: number;
  tax_reserve: number;
  envelopes: number;
  net: number;
  shortfall: number;
  afloat: { amount: number; needed: number; payroll: number; obligations: number; payroll_unconverted: string[]; items: SplitItem[] };
  development: { amount: number | null; pct: number };
  owner: { amount: number | null; pct: number };
  uncomputable_reason: "payroll_unconverted" | null;
  configured: boolean;
  owner_money: { draw_month: number; contribution_month: number; draw_30d: number; contribution_30d: number };
}

export interface AffordMoneyRequest {
  amount: number;
  currency: "UZS";
  date?: string;
  reserve?: number;
  title?: string;
}

export interface AffordMoneyResult {
  verdict: MoneyVerdict;
  amount_uzs: number;
  min_balance_after: number;
  min_balance_date: string;
  gap_date: string | null;
  explanation: string;
  alternatives: { kind: string; title: string; date: string | null; amount: number; verdict: MoneyVerdict }[];
  date: string;
  earliest_date: string | null;
  numbers: { balance_now: number; tax_reserve: number; envelopes: number; extra_reserve: number; buffer: number; lowest_without_purchase: number; max_affordable: number };
  assumptions: string[];
}

export const getSplit = () => api<OwnerSplitData>("/planning/split/");
export const saveSplit = (development_pct: number, owner_pct: number) =>
  api<OwnerSplitData>("/planning/split/", { method: "PUT", body: JSON.stringify({ development_pct, owner_pct }) });
export const checkMoneyAfford = (b: AffordMoneyRequest) => post<AffordMoneyResult>("/planning/afford/", b);
