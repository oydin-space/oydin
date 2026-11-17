import type { Account } from "@/lib/types";

// Счета кэшируются локально, чтобы экран быстрой записи работал без сети.
const KEY = "oydin.quick.accounts";

export function saveAccounts(accounts: Account[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(accounts.map(({ id, name, kind, currency }) => ({ id, name, kind, currency }))));
  } catch {
    /* приватный режим / переполнение: работаем без кэша */
  }
}

export function loadAccounts(): Account[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Account[]) : [];
  } catch {
    return [];
  }
}

/** Канонические значения category лежат в БД по-русски; подпись выбирается из i18n по ключу. */
export const CATEGORIES = {
  in: [
    { value: "Продажа", key: "offline.cat.sale" },
    { value: "Оплата заказа", key: "offline.cat.order" },
    { value: "Предоплата заказа", key: "offline.cat.prepay" },
    { value: "Прочее", key: "offline.cat.other" },
  ],
  out: [
    { value: "Поставщик", key: "offline.cat.supplier" },
    { value: "Аренда", key: "offline.cat.rent" },
    { value: "Зарплата", key: "offline.cat.salary" },
    { value: "Налоги", key: "offline.cat.tax" },
    { value: "Транспорт", key: "offline.cat.transport" },
    { value: "Продукты", key: "offline.cat.food" },
    { value: "Реклама", key: "offline.cat.ads" },
    { value: "Прочее", key: "offline.cat.other" },
  ],
} as const;
