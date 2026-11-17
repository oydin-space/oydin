// Мягкие, округлённые числа: «2,5 млн», «130 тыс.», даты по-русски.
const nf = new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 });

/** 4 000 000 → «4 000 000 сум» */
export function money(n: number): string {
  return `${nf.format(Math.round(n))}\u00a0сум`;
}

/** 2 540 000 → «2,5 млн», 130 000 → «130 тыс.», меньше — как есть. */
export function soft(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  const fmt = (v: number) => (Math.round(v * 10) / 10).toLocaleString("ru-RU", { maximumFractionDigits: 1 });
  if (a >= 1e9) return `${sign}${fmt(a / 1e9)}\u00a0млрд`;
  if (a >= 1e6) return `${sign}${fmt(a / 1e6)}\u00a0млн`;
  if (a >= 1e3) return `${sign}${nf.format(Math.round(a / 1e3))}\u00a0тыс.`;
  return `${sign}${nf.format(a)}`;
}

export const softSum = (n: number) => `${soft(n)}\u00a0сум`;

export function pct(n: number, digits = 0): string {
  return `${n.toLocaleString("ru-RU", { maximumFractionDigits: digits })}%`;
}

const parse = (iso: string) => new Date(`${iso}T00:00:00`);

export function dateShort(iso: string): string {
  return parse(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }).replace(".", "");
}

export function dateLong(iso: string): string {
  return parse(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
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

export function metricValue(unit: "sum" | "pct" | "days" | "count", value: number): string {
  switch (unit) {
    case "sum":
      return softSum(value);
    case "pct":
      return pct(value);
    case "days":
      return `${Math.round(value)}\u00a0${plural(Math.round(value), ["день", "дня", "дней"])}`;
    default:
      return nf.format(value);
  }
}

export const todayIso = () => new Date().toLocaleDateString("sv-SE");
