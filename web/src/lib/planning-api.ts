// Планирование: типы по backend/planning/{views,services}.py. Суммы — целые в минимальных единицах.
import { api, ApiError, post } from "./api";
import type { Currency } from "./types";

export type Frequency = "weekly" | "monthly";
export type Verdict = "yes" | "risky" | "no";

export interface AffordRequest {
  amount: number;
  currency: Currency;
  date?: string;
  title?: string;
  recurring?: Frequency;
}
export interface AffordAlternative {
  kind: "later_date" | "smaller_amount" | "split";
  title: string;
  date: string | null;
  amount: number;
  verdict: Verdict;
}
export interface AffordResult {
  verdict: Verdict;
  amount_uzs: number;
  min_balance_after: number;
  min_balance_date: string;
  gap_date: string | null;
  explanation: string;
  alternatives: AffordAlternative[];
  assumptions: string[];
}
export const checkAfford = (b: AffordRequest) => post<AffordResult>("/decisions/afford/", b);

export interface Account {
  id: number;
  name: string;
  kind: string;
  currency: Currency;
  balance?: number;
  balance_uzs?: number;
}
export const listAccounts = () => api<{ items: Account[] }>("/accounts/");

export interface CashClose {
  id: number;
  date: string;
  account_id: number;
  currency: Currency;
  expected: number;
  counted: number;
  difference: number;
  note: string;
  created_at: string;
}
export interface CashExpected {
  account_id: number;
  date: string;
  currency: Currency;
  expected: number;
}
export const cashExpected = (accountId: number, date: string) => api<CashExpected>(`/cash-close/expected/?account_id=${accountId}&date=${date}`);
export const saveCashClose = (b: { account_id: number; date: string; counted: number; note?: string }, key: string) =>
  api<CashClose>("/cash-close/", { method: "POST", body: JSON.stringify(b), headers: { "Idempotency-Key": key } });

export interface PeriodReport {
  period_from: string;
  period_to: string;
  currency: "UZS";
  revenue: number;
  expenses: number;
  profit: number;
  cash_change: number;
  owner_draws: number;
  owner_contributions: number;
  missing_data: ("unclear_purpose" | "unexplained_cash" | "unit_costs")[];
}
export const periodReport = (from: string, to: string) => api<PeriodReport>(`/reports/period/?from=${from}&to=${to}`);

export type TaxMethod = "fixed" | "percent";
export type TaxPeriod = "month" | "quarter";
export interface TaxReserve {
  enabled: boolean;
  method: TaxMethod;
  fixed_amount: number | null;
  percent: string | null;
  period: TaxPeriod;
  period_from: string;
  period_to: string;
  base_categories: string[];
  base_amount: number;
  reserved: number;
  confirmed_amount: number | null;
  provenance: string;
  disclaimer: string;
}
export interface TaxReserveInput {
  enabled: boolean;
  method: TaxMethod;
  period: TaxPeriod;
  fixed_amount?: number | null;
  percent?: string | null;
  confirmed_amount?: number | null;
  base_categories?: string[];
}

export interface TaxReminder {
  id: number;
  title: string;
  kind: "payment" | "report";
  due_date: string;
  amount: number | null;
  status: "planned" | "done";
  provenance: string;
  notify_telegram: boolean;
  confirmed_at: string;
}
export interface TaxReminderInput {
  title?: string;
  kind?: "payment" | "report";
  due_date?: string;
  amount?: number | null;
  status?: "planned" | "done";
  notify_telegram?: boolean;
  /** Пользователь подтвердил дату: обязательно при создании и смене даты. */
  confirmed?: true;
}
export const getTaxReserve = () => api<TaxReserve>("/tax/reserve/");
export const saveTaxReserve = (b: TaxReserveInput) => api<TaxReserve>("/tax/reserve/", { method: "PUT", body: JSON.stringify(b) });
export const listTaxReminders = () => api<{ items: TaxReminder[] }>("/tax/reminders/");
export const createTaxReminder = (b: TaxReminderInput) => post<TaxReminder>("/tax/reminders/", b);
export const patchTaxReminder = (id: number, b: TaxReminderInput) => api<TaxReminder>(`/tax/reminders/${id}/`, { method: "PATCH", body: JSON.stringify(b) });
export const deleteTaxReminder = (id: number) => api<void>(`/tax/reminders/${id}/`, { method: "DELETE" });

export type GoalKind = "safety_cushion" | "savings" | "revenue" | "expense_cap" | "no_personal_leaks";
export const GOAL_KINDS: GoalKind[] = ["safety_cushion", "savings", "revenue", "expense_cap", "no_personal_leaks"];
export interface Goal {
  id: number;
  kind: GoalKind;
  title: string;
  target: number;
  current: number;
  due_date: string | null;
  status: "active" | "archived" | "achieved";
}
export interface GoalInput {
  kind?: GoalKind;
  title?: string;
  target?: number;
  due_date?: string | null;
  status?: "active" | "archived";
}
export const listGoals = () => api<{ items: Goal[] }>("/goals/");
export const createGoal = (b: GoalInput) => post<Goal>("/goals/", b);
export const patchGoal = (id: number, b: GoalInput) => api<Goal>(`/goals/${id}/`, { method: "PATCH", body: JSON.stringify(b) });
export const deleteGoal = (id: number) => api<void>(`/goals/${id}/`, { method: "DELETE" });

export interface DebtorEntry {
  due_date: string;
  title: string;
  amount: number;
  running_balance: number;
}
export interface Debtor {
  counterparty: string;
  balance: number;
  oldest_due_date: string;
  overdue_days: number;
  entries: DebtorEntry[];
}
export interface DebtorReminder {
  id: number;
  counterparty: string;
  amount: number;
  text: string;
  status: "draft" | "approved";
  created_at: string;
}
export const listDebtors = () => api<{ items: Debtor[] }>("/debtors/");
export const listDebtorReminders = () => api<{ items: DebtorReminder[] }>("/debtors/reminders/");
export const draftDebtorReminder = (counterparty: string) => post<DebtorReminder>("/debtors/reminders/", { counterparty });
export const patchDebtorReminder = (id: number, b: { text?: string; status?: "draft" | "approved" }) =>
  api<DebtorReminder>(`/debtors/reminders/${id}/`, { method: "PATCH", body: JSON.stringify(b) });

export interface Commitment {
  id: number;
  title: string;
  direction: "in" | "out";
  category: string;
  amount: number;
  account_id: number;
  frequency: Frequency;
  next_date: string;
  active: boolean;
  due: boolean;
}
export interface CommitmentInput {
  title?: string;
  category?: string;
  direction?: "in" | "out";
  amount?: number;
  frequency?: Frequency;
  next_date?: string;
  account_id?: number;
  active?: boolean;
}
export const listCommitments = () => api<{ items: Commitment[] }>("/commitments/");
export const createCommitment = (b: CommitmentInput) => post<Commitment>("/commitments/", b);
export const patchCommitment = (id: number, b: CommitmentInput) => api<Commitment>(`/commitments/${id}/`, { method: "PATCH", body: JSON.stringify(b) });
export const deleteCommitment = (id: number) => api<void>(`/commitments/${id}/`, { method: "DELETE" });
export const confirmCommitment = (id: number) => post<{ commitment: Commitment }>(`/commitments/${id}/confirm/`);

export interface Seasonality {
  status: "ok" | "insufficient_history";
  months: number;
  needed: number;
  factors: { month: number; factor: number }[];
}
export const getSeasonality = () => api<Seasonality>("/seasonality/");

export const isForbidden = (e: unknown) => e instanceof ApiError && e.status === 403;
export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

export const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const today = () => isoDay(new Date());
