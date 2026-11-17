// Вызовы раздела «Настройки»: согласия, курсы, интеграции, импорт/экспорт, шеринг, разработчикам.
// Всё идёт через единый api()/post(); типы 1:1 с backend/*/views.py.
import { api, ApiError, post } from "@/lib/api";
import type { Account, Rates } from "@/lib/types";

// ───────────── согласия ─────────────
export type ConsentPurpose = "ai" | "marketing" | "partner_leads";
export interface Consents {
  terms_version: string | null;
  ai: boolean;
  marketing: boolean;
  partner_leads: boolean;
  updated_at: string | null;
}
export const fetchConsents = () => api<Consents>("/consents/");
export const saveConsents = (patch: Partial<Record<ConsentPurpose, boolean>>) =>
  api<Consents>("/consents/", { method: "PUT", body: JSON.stringify(patch) });

export interface PartnerConsent {
  partner: { id: number; name: string; kind: string; logo_url: string | null };
  granted: boolean;
  granted_at: string | null;
  revoked_at: string | null;
  scope: string | string[] | null;
}
export const listPartnerConsents = () => api<{ items: PartnerConsent[] }>("/consents/partner/").then((r) => r.items);
export const grantPartnerConsent = (partnerId: number) => post<PartnerConsent>("/consents/partner/", { partner_id: partnerId });
export const revokePartnerConsent = (partnerId: number) => api<PartnerConsent>(`/consents/partner/${partnerId}/`, { method: "DELETE" });

// ───────────── бизнес ─────────────
export const updateBusiness = (id: number, body: { name: string; segment?: string }) =>
  api<unknown>(`/businesses/${id}/`, { method: "PATCH", body: JSON.stringify(body) });

// ───────────── счета и курс ─────────────
export const listAccounts = () => api<{ items: Account[] }>("/accounts/").then((r) => r.items);
export const fetchRates = () => api<Rates>("/rates/");

// ───────────── Telegram и уведомления (бэк строится параллельно: 404 = «пока недоступно») ─────────────
export interface TelegramLink {
  linked: boolean;
  username?: string | null;
}
export const fetchTelegramLink = () => api<TelegramLink>("/telegram/link/");
export const startTelegramLink = () => post<{ url: string }>("/telegram/link/");
export const unlinkTelegram = () => api<unknown>("/telegram/link/", { method: "DELETE" });

export interface NotificationSettings {
  daily_brief: boolean;
  gap_alerts: boolean;
  weekly_digest: boolean;
  tax_reminders: boolean;
  brief_hour: number;
}
export const fetchNotifications = () => api<NotificationSettings>("/notifications/settings/");
export const saveNotifications = (body: Partial<NotificationSettings>) =>
  api<NotificationSettings>("/notifications/settings/", { method: "PUT", body: JSON.stringify(body) });

export const isMissing = (e: unknown) => e instanceof ApiError && (e.status === 404 || e.status === 405);
export const isForbidden = (e: unknown) => e instanceof ApiError && e.status === 403;

// ───────────── импорт ─────────────
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export type ImportKind = "csv" | "xlsx" | "1c_bank" | "commerceml";
export const MAPPING_FIELDS = ["date", "amount", "inflow", "outflow", "direction", "category", "counterparty", "note", "account", "currency", "skip"] as const;
export type MappingField = (typeof MAPPING_FIELDS)[number];

export interface ImportRow {
  row: number;
  draft: {
    date: string | null;
    amount: number | null;
    direction: "in" | "out" | null;
    category: string;
    account_id: number | null;
    counterparty: string | null;
    note: string;
  };
  duplicate: boolean;
  errors: string[];
}
export interface ImportJob {
  id: number;
  kind: ImportKind;
  filename: string;
  status: "preview" | "committed";
  mapping: Record<string, MappingField>;
  mapping_confidence: number;
  columns: string[];
  total_rows: number;
  preview: ImportRow[];
  created_count: number;
}
export function uploadImport(file: File, accountId?: number) {
  const form = new FormData();
  form.append("file", file);
  if (accountId != null) form.append("account_id", String(accountId));
  return api<ImportJob>("/imports/", { method: "POST", body: form });
}
export const patchImport = (id: number, body: { mapping?: Record<string, MappingField>; account_id?: number }) =>
  api<ImportJob>(`/imports/${id}/`, { method: "PATCH", body: JSON.stringify(body) });
export const commitImport = (id: number, skipDuplicates: boolean) =>
  post<ImportJob>(`/imports/${id}/commit/`, { skip_duplicates: skipDuplicates });

// ───────────── экспорт ─────────────
export type ExportFormat = "csv" | "xlsx" | "1c_bank";
export const EXPORT_EXT: Record<ExportFormat, string> = { csv: "csv", xlsx: "xlsx", "1c_bank": "txt" };

/** Скачивает файл через fetch (куки сессии), чтобы ошибки бэка показывались в интерфейсе, а не страницей JSON. */
export async function downloadExport(format: ExportFormat, from: string, to: string): Promise<void> {
  const q = new URLSearchParams({ format });
  if (from) q.set("from", from);
  if (to) q.set("to", to);
  const res = await fetch(`/api/exports/transactions/?${q}`, { credentials: "include" });
  if (!res.ok) {
    const data: unknown = await res.json().catch(() => null);
    const code = data && typeof data === "object" && "error" in data && typeof data.error === "string" ? data.error : `HTTP ${res.status}`;
    throw new ApiError(res.status, code);
  }
  const href = URL.createObjectURL(await res.blob());
  const a = document.createElement("a");
  a.href = href;
  a.download = `transactions.${EXPORT_EXT[format]}`;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(href);
}

// ───────────── шеринг ─────────────
export interface ShareLink {
  id: number;
  label: string;
  /** Полная ссылка отдаётся только при создании; в списке пусто. */
  url: string;
  period_from: string;
  period_to: string;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
  views: number;
  last_viewed_at: string | null;
}
export const listShareLinks = () => api<{ items: ShareLink[] }>("/share-links/").then((r) => r.items);
export const createShareLink = (body: { label: string; period_from: string; period_to: string; expires_at: string }) =>
  post<ShareLink>("/share-links/", body);
export const revokeShareLink = (id: number) => api<void>(`/share-links/${id}/`, { method: "DELETE" });
/** PDF отчёта по токену из ссылки вида …/shared/<token>. */
export const sharePdfUrl = (url: string) => {
  const token = url.replace(/\/+$/, "").split("/").pop() ?? "";
  return `/api/shared/${token}/report.pdf`;
};

// ───────────── разработчикам ─────────────
export const TOKEN_SCOPES = ["read", "write"] as const;
export type TokenScope = (typeof TOKEN_SCOPES)[number];
export interface ApiTokenItem {
  id: number;
  name: string;
  prefix: string;
  scopes: TokenScope[];
  created_at: string;
  last_used_at: string | null;
}
export const listTokens = () => api<{ items: ApiTokenItem[] }>("/developer/tokens/").then((r) => r.items);
export const createToken = (name: string, scopes: TokenScope[]) => post<ApiTokenItem & { token: string }>("/developer/tokens/", { name, scopes });
export const revokeToken = (id: number) => api<void>(`/developer/tokens/${id}/`, { method: "DELETE" });

export const WEBHOOK_EVENTS = ["transaction.created", "gap.detected"] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
export interface WebhookItem {
  id: number;
  url: string;
  events: WebhookEvent[];
  active: boolean;
  created_at: string;
  last_delivery_status: string | number | null;
}
export const listWebhooks = () => api<{ items: WebhookItem[] }>("/developer/webhooks/").then((r) => r.items);
export const createWebhook = (url: string, events: WebhookEvent[]) => post<WebhookItem & { secret: string }>("/developer/webhooks/", { url, events });
export const patchWebhook = (id: number, body: { active?: boolean; events?: WebhookEvent[] }) =>
  api<WebhookItem>(`/developer/webhooks/${id}/`, { method: "PATCH", body: JSON.stringify(body) });
export const deleteWebhook = (id: number) => api<void>(`/developer/webhooks/${id}/`, { method: "DELETE" });
export const pingWebhook = (id: number) => post<{ status: string | number | null }>(`/developer/webhooks/${id}/ping/`);

// ───────────── тема (хранится локально; подхватывается при следующей загрузке через data-theme) ─────────────
export type ThemeChoice = "system" | "light" | "dark";
const THEME_KEY = "oydin-theme";
export const readTheme = (): ThemeChoice => {
  const v = typeof localStorage === "undefined" ? null : localStorage.getItem(THEME_KEY);
  return v === "light" || v === "dark" ? v : "system";
};
export function applyTheme(choice: ThemeChoice) {
  if (choice === "system") {
    delete document.documentElement.dataset.theme;
    localStorage.removeItem(THEME_KEY);
  } else {
    document.documentElement.dataset.theme = choice;
    localStorage.setItem(THEME_KEY, choice);
  }
}
