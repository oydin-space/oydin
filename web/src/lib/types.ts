// Типы 1:1 с docs/openapi.yaml (components.schemas). Менять только вместе с контрактом.
export type Tone = "calm" | "watch" | "risk";
export type TaxRegime = "unknown" | "turnover" | "simplified_vat" | "general";
export type Direction = "in" | "out" | "transfer";
export type Purpose = "business" | "personal" | "unclear" | "owner_draw" | "owner_contribution";
export type Role = "owner" | "accountant" | "seller";
export type Currency = "UZS" | "USD";

export interface Business {
  id: number;
  name: string;
  industry: string;
  city: string;
  tax_regime: TaxRegime;
}
/** Элемент списка бизнесов в Me. */
export interface BusinessSummary {
  id: number;
  name: string;
  role: Role;
  is_demo: boolean;
}
/** GET /api/businesses/ → {items: BusinessItem[]} */
export interface BusinessItem extends BusinessSummary {
  industry: string;
  city: string;
}
/** Me: GET /api/auth/me/. business = активный бизнес, null пока нет ни одного членства. */
export interface User {
  id: number;
  name: string;
  email: string | null;
  is_staff: boolean;
  role: Role | null;
  active_business_id: number | null;
  needs_onboarding: boolean;
  business: Business | null;
  businesses: BusinessSummary[];
}
export type Me = User;
export interface Member {
  id: number;
  user_id: number | null;
  name: string;
  email: string | null;
  role: Role;
  /** Приглашение ещё не принято (пользователь с этим email не входил). */
  pending: boolean;
  created_at: string;
}
/** GET /api/rates/: rate = сумов за 1 USD. */
export interface Rates {
  date: string;
  USD: string;
  source: string;
  stale: boolean;
}
export interface AuthProviders {
  email: boolean;
  google: boolean;
  telegram: boolean;
  demo: boolean;
}
export interface Metric {
  key: string;
  label: string;
  value: number;
  unit: "sum" | "pct" | "days" | "count";
  tone: Tone;
  hint: string;
  trend?: number[];
}
export interface Pulse {
  score: number;
  tone: Tone;
  headline: string;
  balance: number;
  safe_to_spend: number;
  runway_days: number;
  promises: { kept: number; total: number };
  gap: { date: string; amount: number; reason: string } | null;
  metrics: Metric[];
}
export interface Insight {
  id: string;
  kind: "market" | "local" | "tax" | "own";
  title: string;
  body: string;
  tone: Tone;
  source: string;
  source_url?: string | null;
  as_of: string;
  confidence: "high" | "medium" | "low";
  action?: string | null;
}
export interface Account {
  id: number;
  name: string;
  kind: "cash" | "card" | "bank";
  currency: Currency;
  /** В минимальных единицах валюты счёта (сумы / центы). Продавцу не отдаётся. */
  balance?: number;
  /** Остаток в сумах по последнему курсу. Продавцу не отдаётся. */
  balance_uzs?: number;
}
export interface Transaction {
  id: number;
  date: string;
  amount: number;
  direction: Direction;
  category: string;
  purpose: Purpose;
  account_id: number;
  counterparty?: string | null;
  note: string;
  status: "draft" | "confirmed";
  source: "manual" | "voice" | "chat" | "import" | "seed";
}
export interface TransactionInput {
  date?: string;
  amount: number;
  direction: Direction;
  category: string;
  purpose?: Purpose;
  account_id: number;
  counterparty?: string | null;
  note?: string;
}
export interface Obligation {
  id: number;
  title: string;
  kind: "salary" | "rent" | "tax" | "supplier" | "loan" | "other" | "receivable";
  amount: number;
  due_date: string;
  status: "planned" | "paid" | "overdue";
  covered: boolean;
}
export interface Envelope {
  id: number;
  title: string;
  target: number;
  saved: number;
  due_date: string;
  daily: number;
}
export interface ForecastPoint {
  date: string;
  balance: number;
  inflow: number;
  outflow: number;
}
export interface Product {
  id: number;
  name: string;
  price: number;
  unit_cost: number;
  margin_pct: number;
  markup_pct: number;
  cost_is_estimate: boolean;
}
export interface Chart {
  type: "bar" | "line" | "area" | "pie";
  title: string;
  unit: string;
  data: { label: string; value: number }[];
}
export interface AiReply {
  reply: string;
  suggestions: string[];
  chart?: Chart | null;
  draft?: TransactionInput | null;
  trace_id: string | null;
  fallback?: boolean;
}
export interface VoiceReply {
  text: string;
  draft: TransactionInput | null;
}
export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}
