import type { Locale } from "@/i18n";

/** Системные категории хранятся по-русски (как backend/ai/categories.py); в карточке черновика показываем перевод. */
const NAMES: Record<string, { uz: string; en: string }> = {
  Аренда: { uz: "Ijara", en: "Rent" },
  Зарплата: { uz: "Oylik", en: "Salaries" },
  Налоги: { uz: "Soliqlar", en: "Taxes" },
  Кредит: { uz: "Kredit", en: "Loan" },
  Поставщик: { uz: "Yetkazib beruvchi", en: "Supplier" },
  Реклама: { uz: "Reklama", en: "Advertising" },
  Транспорт: { uz: "Transport", en: "Transport" },
  Питание: { uz: "Ovqat", en: "Food" },
  Продукты: { uz: "Oziq-ovqat", en: "Groceries" },
  Коммунальные: { uz: "Kommunal", en: "Utilities" },
  Продажи: { uz: "Sotuvlar", en: "Sales" },
  Розница: { uz: "Chakana savdo", en: "Retail" },
  "Оплата заказа": { uz: "Buyurtma toʻlovi", en: "Order payment" },
  "Предоплата заказа": { uz: "Buyurtma oldindan toʻlovi", en: "Order prepayment" },
  Кофе: { uz: "Qahva", en: "Coffee" },
  "Кофе и молоко": { uz: "Qahva va sut", en: "Coffee and milk" },
  "Кофемашина в рассрочку": { uz: "Qahva mashinasi (muddatli toʻlov)", en: "Coffee machine (instalments)" },
  Одежда: { uz: "Kiyim", en: "Clothing" },
  Прочее: { uz: "Boshqa", en: "Other" },
  Личное: { uz: "Shaxsiy", en: "Personal" },
  Владельцу: { uz: "Egasiga", en: "Owner draw" },
  Перевод: { uz: "Oʻtkazma", en: "Transfer" },
};

/** Подпись категории на языке интерфейса; своя категория пользователя — как есть. */
export function categoryName(name: string, locale: Locale): string {
  return locale === "ru" ? name : (NAMES[name]?.[locale] ?? name);
}
