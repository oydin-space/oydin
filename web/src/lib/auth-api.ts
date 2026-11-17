// Вызовы входа, бизнесов и команды (docs/openapi.yaml v0.3). Всё идёт через единый api()/post().
import { api, ApiError, post } from "@/lib/api";
import type { AuthProviders, BusinessItem, Currency, Me, Role } from "@/lib/types";

export type Segment = "textile_print" | "retail" | "horeca" | "marketplace_seller" | "services";
export type AccountKind = "cash" | "card" | "bank";

/** Участник по openapi `Member` (status/invited_email), а не устаревший `pending` из types.ts. */
export interface TeamMember {
  id: number;
  user_id: number | null;
  name: string;
  email: string | null;
  invited_email: string | null;
  role: Role;
  status: "active" | "invited";
  created_at: string;
}

export const fetchProviders = () => api<AuthProviders>("/auth/providers/");
export const requestEmailCode = (email: string, lang = "ru") => post<{ ok: true; resend_in: number }>("/auth/email/request/", { email, lang });
export const verifyEmailCode = (email: string, code: string) => post<Me>("/auth/email/verify/", { email, code });
export const demoLogin = () => post<Me>("/auth/demo/");
export const fetchMe = () => api<Me>("/auth/me/");
export const logout = () => post<void>("/auth/logout/");

export const TERMS_VERSION = "2026-11-18";
export interface ConsentChoice {
  terms: boolean;
  ai: boolean;
  marketing: boolean;
}
export const noConsent: ConsentChoice = { terms: false, ai: false, marketing: false };
export const saveConsent = (c: ConsentChoice) => api<unknown>("/consents/", { method: "PUT", body: JSON.stringify({ ...(c.terms ? { terms_version: TERMS_VERSION } : {}), ai: c.ai, marketing: c.marketing }) });

// Выбор, сделанный до редиректа на Google, дожидается сессии в sessionStorage.
const PENDING = "oydin-consent";
export const stashConsent = (c: ConsentChoice) => sessionStorage.setItem(PENDING, JSON.stringify(c));
export async function flushStashedConsent() {
  const raw = sessionStorage.getItem(PENDING);
  if (!raw) return;
  sessionStorage.removeItem(PENDING);
  await saveConsent(JSON.parse(raw) as ConsentChoice).catch(() => undefined);
}

export interface BusinessInput {
  name: string;
  industry?: string;
  city?: string;
}
export const createBusiness = (body: BusinessInput) => post<BusinessItem>("/businesses/", body);
export const setSegment = (id: number, segment: Segment) => api<unknown>(`/businesses/${id}/`, { method: "PATCH", body: JSON.stringify({ segment }) });
export const switchBusiness = (id: number) => post<Me>(`/businesses/${id}/switch/`);
export const createAccount = (body: { name: string; kind: AccountKind; currency: Currency; opening_balance: number }) => post<unknown>("/accounts/", body);

export const listMembers = (businessId: number) => api<{ items: TeamMember[] }>(`/businesses/${businessId}/members/`).then((r) => r.items);
export const inviteMember = (businessId: number, email: string, role: Role) => post<TeamMember>(`/businesses/${businessId}/members/`, { email, role });
export const changeMemberRole = (businessId: number, memberId: number, role: Role) =>
  api<TeamMember>(`/businesses/${businessId}/members/${memberId}/`, { method: "PATCH", body: JSON.stringify({ role }) });
export const removeMember = (businessId: number, memberId: number) => api<void>(`/businesses/${businessId}/members/${memberId}/`, { method: "DELETE" });

/** Код ошибки бэка (`{"error": code}`) → ключ словаря; неизвестные → fallback. */
export function errorText(e: unknown, dict: Record<string, string>, fallback: string): string {
  if (e instanceof ApiError) return dict[e.message] ?? dict[`http_${e.status}`] ?? fallback;
  return fallback;
}
