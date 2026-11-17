import { describe, expect, test } from "bun:test"
import { dictionaries, detectLocale, formatDate, formatMoney, formatSumShort, parseLocale, readCookie, translate } from "./core"

describe("translate", () => {
  test("per locale", () => {
    expect(translate("ru", "nav.operations")).toBe("Операции")
    expect(translate("uz", "nav.operations")).toBe("Operatsiyalar")
    expect(translate("en", "nav.operations")).toBe("Operations")
  })
  test("fallback to ru then key", () => {
    const uz = dictionaries.uz as Record<string, string>
    const saved = uz["nav.more"]
    delete uz["nav.more"]
    expect(translate("uz", "nav.more")).toBe("Ещё")
    uz["nav.more"] = saved
    expect(translate("en", "no.such.key" as never)).toBe("no.such.key")
  })
  test("interpolation", () => {
    expect(translate("en", "auth.codeSent", { phone: "+998" })).toBe("We sent a code to +998")
    expect(translate("en", "auth.codeSent")).toContain("{phone}")
  })
  test("plural", () => {
    const r = (n: number) => translate("ru", "common.days", { count: n })
    expect(r(1)).toBe("1 день")
    expect(r(2)).toBe("2 дня")
    expect(r(5)).toBe("5 дней")
    expect(r(21)).toBe("21 день")
    expect(translate("en", "common.days", { count: 1 })).toBe("1 day")
    expect(translate("en", "common.days", { count: 3 })).toBe("3 days")
    expect(translate("uz", "common.days", { count: 3 })).toBe("3 kun")
  })
})

describe("dictionaries", () => {
  test("same keys, no Cyrillic in uz", () => {
    const keys = Object.keys(dictionaries.ru).sort()
    expect(Object.keys(dictionaries.uz).sort()).toEqual(keys)
    expect(Object.keys(dictionaries.en).sort()).toEqual(keys)
    for (const v of Object.values(dictionaries.uz)) expect(/[\u0400-\u04FF]/.test(v)).toBe(false)
  })
})

describe("detect", () => {
  test("order cookie > telegram > navigator > ru", () => {
    expect(detectLocale({ cookie: "en", telegram: "uz", navigator: "ru" })).toBe("en")
    expect(detectLocale({ telegram: "uz", navigator: "en-US" })).toBe("uz")
    expect(detectLocale({ navigator: ["de", "en-GB"] })).toBe("en")
    expect(detectLocale({ cookie: "xx", navigator: "de" })).toBe("ru")
    expect(parseLocale("uz-Cyrl")).toBe("uz")
  })
  test("readCookie", () => {
    expect(readCookie("a=1; oydin_lang=uz; b=2")).toBe("uz")
    expect(readCookie("a=1")).toBeNull()
  })
})

describe("formatting", () => {
  test("friendly sums", () => {
    expect(formatSumShort(3_000_000, "ru")).toBe("3\u00a0млн")
    expect(formatSumShort(3_000_000, "uz")).toBe("3\u00a0mln")
    expect(formatSumShort(3_000_000, "en")).toBe("3M")
    expect(formatSumShort(2_500_000, "en")).toBe("2.5M")
    expect(formatSumShort(950, "en")).toBe("950")
  })
  test("money and date", () => {
    expect(formatMoney(1250000, "en").replace(/[\s\u00a0\u202f]/g, " ")).toBe("1,250,000 UZS")
    expect(formatMoney(1250000, "ru")).toEndWith("\u00a0сум")
    expect(formatDate("2026-03-05T12:00:00Z", "en")).toBe("March 5")
  })
})
