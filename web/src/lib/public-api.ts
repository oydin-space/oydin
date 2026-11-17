// Публичные вызовы и партнёрский кабинет (docs/openapi.yaml, backend/sharing/views.py).
import { api, ApiError } from "@/lib/api";

export interface Impact {
  businesses: number;
  operations_recorded: number;
  cash_closes: number;
  gaps_flagged: number;
  /** true при малой выборке (k-анонимность): все счётчики = 0 и скрыты. */
  suppressed: boolean;
  updated_at: string;
}

export interface SharedReport {
  business_name: string;
  generated_at: string;
  period: {
    period_from: string;
    period_to: string;
    currency: "UZS";
    revenue: number;
    expenses: number;
    /** null, если у части операций не указана цель. */
    profit: number | null;
    cash_change: number;
    owner_draws: number;
    owner_contributions: number;
    missing_data: string[];
  };
  accounts: { id: number; name: string; kind: "cash" | "card" | "bank"; currency: "UZS" | "USD"; balance: number; balance_uzs: number }[];
  by_category: { category: string; inflow: number; outflow: number }[];
  obligations: { id: number; title: string; kind: string; amount: number; due_date: string; status: "planned" | "paid" | "overdue"; covered: boolean }[];
  cash_closes: { id: number; date: string; currency: string; expected: number; counted: number; difference: number; note: string }[];
  disclaimer: string;
}

export type SharedResult =
  | { state: "ok"; report: SharedReport }
  | { state: "notFound" | "gone" | "rateLimited" | "error" };

export const sharedPdfUrl = (token: string) => `/api/shared/${encodeURIComponent(token)}/report.pdf`;

export async function loadShared(token: string): Promise<SharedResult> {
  try {
    return { state: "ok", report: await api<SharedReport>(`/shared/${encodeURIComponent(token)}/`) };
  } catch (e) {
    if (e instanceof ApiError) {
      if (e.status === 404) return { state: "notFound" };
      if (e.status === 410) return { state: "gone" };
      if (e.status === 429) return { state: "rateLimited" };
    }
    return { state: "error" };
  }
}

export async function loadImpact(): Promise<Impact | null> {
  try {
    return await api<Impact>("/impact/");
  } catch {
    return null;
  }
}

export type LeadStatus = "new" | "contacted" | "closed";
export const LEAD_STATUSES: readonly LeadStatus[] = ["new", "contacted", "closed"];

export interface PartnerMe {
  partner: { id: number; name: string; kind: "bank" | "mfo"; logo_url: string };
  name: string;
  email: string;
}

export interface PartnerLead {
  id: string;
  segment: string;
  city: string;
  months_active: number;
  revenue_band: string;
  gap_amount_band: string | null;
  gap_date: string | null;
  consented_at: string;
  status: LeadStatus;
}

export const fetchPartnerMe = () => api<PartnerMe>("/partner/me/");
export const fetchPartnerLeads = () => api<{ items: PartnerLead[] }>("/partner/leads/");
export const setLeadStatus = (id: string, status: LeadStatus) =>
  api<PartnerLead>(`/partner/leads/${encodeURIComponent(id)}/`, { method: "PATCH", body: JSON.stringify({ status }) });

export const REQUEST_ACCESS_URL = "https://t.me/oydin_agent";
