import { api } from "@/lib/api";

export interface RollupFigures {
  net_uzs: number;
  inflow_30d_uzs: number;
  outflow_30d_uzs: number;
  receivable_uzs: number;
  payable_uzs: number;
  headcount: number;
}

export interface RollupBusiness extends RollupFigures {
  id: number;
  name: string;
  role: "owner" | "accountant";
  is_demo: boolean;
}

export interface Rollup {
  businesses: RollupBusiness[];
  totals: RollupFigures;
  window_days: number;
}

export const getRollup = () => api<Rollup>("/rollup/");
