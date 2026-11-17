// Вызовы входа, бизнесов и команды (docs/openapi.yaml v0.3). Всё идёт через единый api()/post().
import { api, ApiError, post } from "@/lib/api";
import { clearAccounts } from "@/lib/offline/reference";
import { ME_SNAPSHOT_KEY } from "@/lib/offline/scope";
import { resetOfflineState } from "@/lib/offline/sync";
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
export const demoLogin = () => post<Me>("/auth/demo/", {});
export const fetchMe = () => api<Me>("/auth/me/");
/** Выход чистит локальное в finally: офлайн-выход тоже стирает снимок, кэш счетов и закэшированные страницы /app/*. Несинхронизированные записи остаются, но чужим пользователям не видны (скоуп). */
export const logout = async () => {
  try {
    await post<void>("/auth/logout/");
  } finally {
    try {
      localStorage.removeItem(ME_SNAPSHOT_KEY);
    } catch {}
    clearAccounts();
    await clearCachedPages();
    await resetOfflineState().catch(() => undefined);
  }
};

async function clearCachedPages() {
  if (typeof caches === "undefined") return;
  try {
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      for (const req of await cache.keys()) if (new URL(req.url).pathname.startsWith("/app")) await cache.delete(req);
    }
  } catch {}
}

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
/** Снимок сессии обновляется сразу: очередь и кэш счетов привязаны к активному бизнесу. */
export async function switchBusiness(id: number) {
  const me = await post<Me>(`/businesses/${id}/switch/`);
  try {
    localStorage.setItem(ME_SNAPSHOT_KEY, JSON.stringify(me));
  } catch {}
  await resetOfflineState().catch(() => undefined);
  return me;
}
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

export interface TelegramWidgetUser {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}
export const telegramWidgetLogin = (user: TelegramWidgetUser) => post<Me>("/auth/telegram/widget/", user);
