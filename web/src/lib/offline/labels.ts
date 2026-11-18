import { CATEGORIES } from "./reference";

type T = (key: string, params?: Record<string, string | number>) => string;

/** Счета, которые создаёт система: в БД лежат по-русски, поэтому подпись берём из i18n, пока имя не менялось. */
const DEFAULT_ACCOUNT_KEYS: Record<string, string> = {
  "Наличные": "offline.acct.cash",
  "Карта": "offline.acct.card",
  "Расчётный счёт": "offline.acct.bank",
};

export const accountLabel = (name: string, t: T): string => {
  const key = DEFAULT_ACCOUNT_KEYS[name];
  return key ? t(key) : name;
};

export interface CategoryOption {
  /** Каноническое значение, уходит на сервер. */
  value: string;
  /** Подпись на языке интерфейса. */
  label: string;
}

const norm = (s: string) => s.trim().toLocaleLowerCase();
const words = (s: string) => norm(s).split(/[^\p{L}\p{N}]+/u).filter(Boolean);
const stem = (w: string) => w.slice(0, Math.max(4, w.length - 2));

/** 0 — точное совпадение, дальше по убыванию близости; null — не подходит. */
function rank(q: string, option: CategoryOption): number | null {
  const names = [norm(option.value), norm(option.label)];
  if (names.includes(q)) return 0;
  if (names.some((n) => n.startsWith(q))) return 1;
  // «Аренда зала» → уже существующая «Аренда»: введённый текст содержит имя категории.
  if (names.some((n) => q.includes(n))) return 2;
  if (names.some((n) => n.includes(q))) return 3;
  const typed = words(q).map(stem);
  const known = names.flatMap(words).map(stem);
  return typed.some((w) => w.length >= 3 && known.some((k) => k.startsWith(w) || w.startsWith(k))) ? 4 : null;
}

/**
 * Категории для чипов: сначала уже существующие в бизнесе (по частоте), затем стандартные.
 * Если что-то набрано — остаются только подходящие, самые близкие первыми.
 */
export function categoryOptions(direction: "in" | "out", existing: string[], query: string, t: T, localize: (name: string) => string = (n) => n): CategoryOption[] {
  const label = new Map<string, string>(CATEGORIES[direction].map((c) => [norm(c.value), t(c.key)]));
  const options: CategoryOption[] = [];
  const seen = new Set<string>();
  for (const value of [...existing, ...CATEGORIES[direction].map((c) => c.value)]) {
    const key = norm(value);
    if (seen.has(key)) continue;
    seen.add(key);
    options.push({ value, label: label.get(key) ?? localize(value) });
  }
  const q = norm(query);
  if (!q) return options;
  return options
    .map((o, i) => ({ o, r: rank(q, o), i }))
    .filter((x): x is { o: CategoryOption; r: number; i: number } => x.r !== null)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((x) => x.o);
}

/** Категории из последних операций, самые частые первыми. */
export function existingCategories(items: { category: string; direction: string }[], direction: "in" | "out"): string[] {
  const counts = new Map<string, { value: string; n: number }>();
  for (const it of items) {
    if (it.direction !== direction || !it.category) continue;
    const key = norm(it.category);
    const entry = counts.get(key);
    if (entry) entry.n += 1;
    else counts.set(key, { value: it.category, n: 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).map((x) => x.value);
}

const LAST_ACCOUNT = "oydin.entry.lastAccount";
const lastCategoryKey = (d: string) => `oydin.entry.lastCategory.${d}`;

export function readLast(key: "account" | "in" | "out"): string | null {
  try {
    return localStorage.getItem(key === "account" ? LAST_ACCOUNT : lastCategoryKey(key));
  } catch {
    return null;
  }
}

export function rememberLast(key: "account" | "in" | "out", value: string) {
  try {
    localStorage.setItem(key === "account" ? LAST_ACCOUNT : lastCategoryKey(key), value);
  } catch {
    /* приватный режим: без запоминания */
  }
}

/** Последний использованный счёт, если он ещё есть, иначе первый. */
export function defaultAccountId(accounts: { id: number }[]): string {
  const last = readLast("account");
  return String(accounts.find((a) => String(a.id) === last)?.id ?? accounts[0]?.id ?? "");
}
