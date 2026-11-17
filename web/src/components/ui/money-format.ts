/**
 * Единственный форматтер денег в UI (правило 10). Суммы — целые числа в минимальной единице валюты:
 * UZS — сум, USD — центы. Никакой арифметики с плавающей точкой над хранимыми значениями.
 */
export type Currency = "UZS" | "USD";
export type MoneyLocale = "ru" | "uz" | "en";
export type MoneyMode = "exact" | "compact";

const MINUS = "\u2212";
const NBSP = "\u00a0";

const WORDS: Record<MoneyLocale, { k: string; m: string; b: string; uzs: string; usd: string }> = {
  ru: { k: "тыс.", m: "млн", b: "млрд", uzs: "сум", usd: "$" },
  uz: { k: "ming", m: "mln", b: "mlrd", uzs: "so\u02bbm", usd: "$" },
  en: { k: "k", m: "m", b: "b", uzs: "UZS", usd: "$" },
};

const groupFmt = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });
const enFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
const decimal = (loc: MoneyLocale) => (loc === "en" ? "." : ",");

/** Минимальные единицы → основные. USD: 12345 → 123.45 (только для отображения). */
const minorDigits = (c: Currency) => (c === "USD" ? 2 : 0);

function oneDecimal(v: number, loc: MoneyLocale): string {
  const r = Math.round(v * 10) / 10;
  const s = Number.isInteger(r) ? String(r) : r.toFixed(1);
  return s.replace(".", decimal(loc));
}

function compactParts(major: number, loc: MoneyLocale): string {
  const w = WORDS[loc];
  const a = Math.abs(major);
  if (a < 1000) return (loc === "en" ? enFmt : groupFmt).format(Math.round(a));
  const units: [number, string][] = [
    [1e3, w.k],
    [1e6, w.m],
    [1e9, w.b],
  ];
  let idx = a >= 1e9 ? 2 : a >= 1e6 ? 1 : 0;
  let scaled = Math.round((a / units[idx][0]) * 10) / 10;
  // 999 950 → «1000 тыс.» → «1 млн»
  while (scaled >= 1000 && idx < 2) {
    idx += 1;
    scaled = Math.round((a / units[idx][0]) * 10) / 10;
  }
  const sep = loc === "en" ? "" : NBSP;
  return `${oneDecimal(scaled, loc)}${sep}${units[idx][1]}`;
}

function exactParts(minor: number, currency: Currency, loc: MoneyLocale): string {
  const digits = minorDigits(currency);
  const a = Math.abs(minor);
  const fmt = loc === "en" ? "en-US" : "ru-RU";
  if (digits === 0) return (loc === "en" ? enFmt : groupFmt).format(a);
  const major = Math.trunc(a / 100);
  const cents = a % 100;
  const base = new Intl.NumberFormat(fmt, { maximumFractionDigits: 0 }).format(major);
  return cents === 0 ? base : `${base}${decimal(loc)}${String(cents).padStart(2, "0")}`;
}

export interface FormatMoneyOptions {
  currency?: Currency;
  locale?: MoneyLocale;
  mode?: MoneyMode;
  /** «always» добавляет «+» для положительных. */
  sign?: "auto" | "always";
  /** Показывать ли валюту; false — только число. */
  withCurrency?: boolean;
}

/** null / NaN → «—». Минус — U+2212. */
export function formatMoney(minor: number | null | undefined, opts: FormatMoneyOptions = {}): string {
  const { currency = "UZS", locale = "ru", mode = "exact", sign = "auto", withCurrency = true } = opts;
  if (minor == null || Number.isNaN(minor)) return "\u2014";
  const w = WORDS[locale];
  const neg = minor < 0;
  const signStr = neg ? MINUS : sign === "always" && minor > 0 ? "+" : "";
  const body =
    mode === "compact" ? compactParts(Math.abs(minor) / 10 ** minorDigits(currency), locale) : exactParts(minor, currency, locale);
  if (!withCurrency) return `${signStr}${body}`;
  if (currency === "USD") return locale === "en" ? `${signStr}$${body}` : `${signStr}${body}${NBSP}$`;
  return locale === "en" ? `${signStr}${w.uzs}${NBSP}${body}` : `${signStr}${body}${NBSP}${w.uzs}`;
}

const MULT: Record<string, number> = {
  "": 1,
  "к": 1e3, k: 1e3, "тыс": 1e3, ming: 1e3,
  "м": 1e6, m: 1e6, "млн": 1e6, mln: 1e6,
  "млрд": 1e9, b: 1e9, mlrd: 1e9,
};

/**
 * Ввод пользователя → целое в минимальных единицах. Понимает «3 млн», «500к», «2,5m», «1 200 000».
 * Неразборчивое → null.
 */
export function parseAmount(text: string, currency: Currency): number | null {
  const m = text
    .trim()
    .toLowerCase()
    .replace(/[\s\u00a0]/g, "")
    .match(/^(\d+(?:[.,]\d+)?)(млрд|млн|тыс|mlrd|mln|ming|[кkмmb])?\.?$/);
  if (!m) return null;
  const mult = MULT[m[2] ?? ""];
  const num = Number(m[1].replace(",", "."));
  if (!Number.isFinite(num)) return null;
  return Math.round(num * mult * 10 ** minorDigits(currency));
}

export const currencyLabel = (c: Currency, loc: MoneyLocale = "ru") => (c === "USD" ? "USD" : loc === "en" ? "UZS" : WORDS[loc].uzs);
