// Мягкие, округлённые числа и даты с учётом языка интерфейса (ru / uz-latin / en).
export type FormatLocale = "ru" | "uz" | "en";

const INTL: Record<FormatLocale, string> = { ru: "ru-RU", uz: "ru-RU", en: "en-US" }; // uz numbers: comma decimal like ru; uz dates are assembled by hand

const UNITS: Record<FormatLocale, { k: string; m: string; b: string; sum: string; day: [string, string, string] }> = {
  ru: { k: "тыс.", m: "млн", b: "млрд", sum: "сум", day: ["день", "дня", "дней"] },
  uz: { k: "ming", m: "mln", b: "mlrd", sum: "soʻm", day: ["kun", "kun", "kun"] },
  en: { k: "K", m: "M", b: "B", sum: "UZS", day: ["day", "days", "days"] },
};

const NBSP = "\u00a0";
const nfs = {} as Record<FormatLocale, Intl.NumberFormat>;
const nf = (l: FormatLocale) => (nfs[l] ??= new Intl.NumberFormat(INTL[l], { maximumFractionDigits: 0 }));

/** 4 000 000 → «4 000 000 сум» / «UZS 4,000,000». */
export function money(n: number, locale: FormatLocale = "ru"): string {
  const body = nf(locale).format(Math.round(n));
  return locale === "en" ? `${UNITS.en.sum}${NBSP}${body}` : `${body}${NBSP}${UNITS[locale].sum}`;
}

/** 2 540 000 → «2,5 млн» / «2.5M», 130 000 → «130 тыс.» / «130K», меньше — как есть. */
export function soft(n: number, locale: FormatLocale = "ru"): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const u = UNITS[locale];
  const gap = locale === "en" ? "" : NBSP;
  const fmt = (v: number) => (Math.round(v * 10) / 10).toLocaleString(INTL[locale], { maximumFractionDigits: 1 });
  if (a >= 1e9) return `${sign}${fmt(a / 1e9)}${gap}${u.b}`;
  if (a >= 1e6) return `${sign}${fmt(a / 1e6)}${gap}${u.m}`;
  if (a >= 1e3) return `${sign}${nf(locale).format(Math.round(a / 1e3))}${gap}${u.k}`;
  return `${sign}${nf(locale).format(a)}`;
}

export const softSum = (n: number, locale: FormatLocale = "ru") => {
  const body = soft(n, locale);
  return locale === "en" ? `${UNITS.en.sum}${NBSP}${body}` : `${body}${NBSP}${UNITS[locale].sum}`;
};

export function pct(n: number, digits = 0, locale: FormatLocale = "ru"): string {
  return `${n.toLocaleString(INTL[locale], { maximumFractionDigits: digits })}%`;
}

const parse = (iso: string) => new Date(`${iso.slice(0, 10)}T00:00:00`);

/**
 * Названия месяцев на узбекском (латиница). Intl в uz-UZ во многих браузерах отдаёт «M12»,
 * поэтому для uz дату собираем сами.
 */
export const UZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avgust", "sentabr", "oktabr", "noyabr", "dekabr"];
const UZ_MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avg", "sen", "okt", "noy", "dek"];

/** Название месяца (0-based) в именительном падеже: «ноябрь» / «noyabr» / «November». */
export function monthName(month: number, locale: FormatLocale = "ru", year = 2000): string {
  if (locale === "uz") return UZ_MONTHS[month];
  return new Intl.DateTimeFormat(INTL[locale], { month: "long" }).format(new Date(year, month, 1));
}

/** «10 декабря» / «10-dekabr» / «December 10»; style short — «10 дек» / «10-dek» / «Dec 10». Принимает ISO-дату или Date. */
export function dayMonth(value: string | Date, locale: FormatLocale = "ru", style: "long" | "short" = "long"): string {
  const d = typeof value === "string" ? parse(value) : value;
  if (locale === "uz") return `${d.getDate()}-${(style === "long" ? UZ_MONTHS : UZ_MONTHS_SHORT)[d.getMonth()]}`;
  return d.toLocaleDateString(INTL[locale], { day: "numeric", month: style }).replace(".", "");
}

export function dateShort(iso: string, locale: FormatLocale = "ru"): string {
  return dayMonth(iso, locale, "short");
}

export function dateLong(iso: string, locale: FormatLocale = "ru"): string {
  const d = parse(iso);
  if (locale === "uz") return `${d.getFullYear()}-yil ${dayMonth(d, "uz")}`;
  return d.toLocaleDateString(INTL[locale], { day: "numeric", month: "long", year: "numeric" });
}

export function plural(n: number, forms: [string, string, string]): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return forms[0];
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return forms[1];
  return forms[2];
}

export function daysUntil(iso: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((parse(iso).getTime() - today.getTime()) / 86400000);
}

export function metricValue(unit: "sum" | "pct" | "days" | "count", value: number, locale: FormatLocale = "ru"): string {
  switch (unit) {
    case "sum":
      return softSum(value, locale);
    case "pct":
      return pct(value, 0, locale);
    case "days":
      return `${Math.round(value)}\u00a0${plural(Math.round(value), UNITS[locale].day)}`;
    default:
      return nf(locale).format(value);
  }
}

export const todayIso = () => new Date().toLocaleDateString("sv-SE");
