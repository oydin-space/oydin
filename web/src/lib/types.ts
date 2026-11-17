// Типы 1:1 с docs/openapi.yaml (components.schemas). Менять только вместе с контрактом.
export type Tone = "calm" | "watch" | "risk";
export type TaxRegime = "unknown" | "turnover" | "simplified_vat" | "general";
export type Direction = "in" | "out" | "transfer";
export type Purpose = "business" | "personal" | "unclear";

export interface Business {
  id: number;
  name: string;
  industry: string;
  city: string;
  tax_regime: TaxRegime;
}
export interface User {
  id: number;
  name: string;
  business: Business;
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
  balance: number;
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
