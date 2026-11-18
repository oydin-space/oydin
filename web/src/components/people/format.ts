import type { Locale, TFunction } from "@/i18n/core";
import { ApiError } from "@/lib/api";

/** Decimal string from the API → grouped number for the interface language. */
export function formatDecimal(value: string | null, locale: Locale): string {
  const n = Number(value);
  if (value == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(locale === "uz" ? "uz-Latn-UZ" : locale, { maximumFractionDigits: 2 }).format(n);
}

/** Backend error messages are Russian prose: only status and the demo_tenant code are mapped. */
export function peopleError(e: unknown, t: TFunction): string {
  if (e instanceof ApiError) {
    if (e.message === "demo_tenant") return t("people.err.demo_tenant");
    if (e.status === 403) return t("people.err.http_403");
    if (e.status === 404) return t("people.err.http_404");
    if (e.status === 400) return t("people.err.http_400");
  }
  return t("people.err.generic");
}
