// Контракт /api/onboarding/* (docs/openapi.yaml → Onboarding*). Все запросы — через единый api().
import { api, post } from "@/lib/api";

export const STEPS = ["consent", "name", "contact", "business", "activity", "pains", "goals", "upload", "invite", "install", "tour", "summary"] as const;
export type Step = (typeof STEPS)[number];
export type StepStatus = "pending" | "done" | "skipped" | "n/a";
export const ACT_TWO: readonly Step[] = ["install", "tour", "summary"];

export const PAINS = ["cash_gaps", "debts", "taxes", "chaos", "stock", "pricing", "team", "growth"] as const;
export const GOALS = ["see_profit", "collect_debts", "taxes_on_time", "save", "grow", "credit", "start"] as const;
export const SEGMENTS = ["textile_print", "retail", "horeca", "marketplace_seller", "services", "other"] as const;
export const TEAM = ["solo", "2_5", "6_20", "20plus"] as const;
export const LEGAL_FORMS = ["yatt", "llc", "self_employed", "family", "other"] as const;
export const CHANNELS = ["app", "telegram", "email"] as const;

export interface Plan {
  price: number;
  unit_cost: number;
  units_per_month: number;
  fixed_costs_per_month: number;
  startup_costs: number;
  margin: number;
  monthly_profit: number;
  breakeven_units: number | null;
  payback_months: number | null;
}

export interface OnboardingState {
  done: boolean;
  step: Step | null;
  steps?: Partial<Record<Step, StepStatus>>;
  progress?: { done: number; total: number };
  role?: "owner" | "accountant" | "seller" | null;
  ai_consent?: boolean;
  prefill?: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string;
    telegram: string;
    channel: (typeof CHANNELS)[number];
    language: string | null;
    brief_time: string | null;
    business: { id: number; name: string; segment: string } | null;
  };
  answers?: Partial<Record<Step, Record<string, unknown>>> & { activity?: { plan?: Plan }; business?: { stage?: string; name?: string } };
}

export interface CompanyCandidate {
  name: string;
  inn: string;
  legal_form: string;
  status: string;
  registered_at: string;
  address: string;
  director: string;
  oked: string;
  activity: string;
}

export interface LookupResult {
  lookup_id: number;
  kind: "inn" | "pinfl" | "name";
  status: "found" | "multiple" | "not_found" | "unavailable";
  source: string | null;
  official: boolean;
  candidates: CompanyCandidate[];
  fetched_at: string;
}

export interface AgentReply {
  say: string | null;
  say_key: string | null;
  lookup: LookupResult | null;
  state: OnboardingState;
}

export interface MemoryContext {
  user: { name: string; email: string; role: string } | null;
  memory: { id: number; scope: "user" | "business"; text: string }[];
  business: { name: string; inn: string; activity: string; plans: string; problems: string } | null;
}

export interface Invite {
  id: number;
  code: string;
  role: "accountant" | "seller";
  expires_at: string;
}

export const getState = () => api<OnboardingState>("/onboarding/state/");
export const submitStep = (step: Step, value?: Record<string, unknown>) =>
  post<OnboardingState>("/onboarding/answer/", { step, action: "submit", value: value ?? {} });
export const skipStep = (step: Step) => post<OnboardingState>("/onboarding/answer/", { step, action: "skip" });
export const lookupCompany = (query: string) => post<LookupResult>("/onboarding/lookup/", { query });
export const sendMessage = (step: Step, text: string, lang: string) => post<AgentReply>("/onboarding/message/", { step, text, lang });
export const getMemory = () => api<MemoryContext>("/onboarding/context/");
export const createInvite = (businessId: number, role: Invite["role"]) => post<Invite>(`/businesses/${businessId}/invites/`, { role });
