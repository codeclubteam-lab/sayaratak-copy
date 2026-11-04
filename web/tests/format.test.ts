import { expect, it } from "vitest"

import { normalizeDigits } from "@sayaratak/shared/lib/digits"
import {
  formatDate,
  formatMileage,
  formatNumber,
  formatPrice,
  formatRelative,
} from "@/lib/format"
import { createI18n } from "@/lib/i18n/create"
import { clamp } from "@/lib/utils"

const now = Date.parse("2026-10-04T12:00:00Z")
const ago = (ms: number) => new Date(now - ms).toISOString()

it("converts Arabic-Indic and Persian digits", () => {
  expect(normalizeDigits("٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹ a1")).toBe(
    "0123456789 0123456789 a1"
  )
})

it("formats price with Latin digits and a per-language unit", () => {
  expect(formatPrice(4500000, "en")).toEqual({
    amount: "4,500,000",
    unit: "SDG",
  })
  expect(formatPrice(4500000, "ar")).toEqual({
    amount: "4,500,000",
    unit: "جنيه",
  })
  expect(formatNumber(999, "ar")).toBe("999")
  expect(formatMileage(120000, "en")).toBe("120,000 km")
  expect(formatMileage(120000, "ar")).toBe("120,000 كم")
})

it("formats dates in Khartoum time", () => {
  // 23:30 UTC is already the next day at UTC+2
  expect(formatDate("2026-10-04T23:30:00Z", "en")).toBe("Oct 5, 2026")
  expect(formatDate("2026-10-04T23:30:00Z", "ar")).toContain("2026")
})

it("formats relative time by age", () => {
  const h = 3600_000
  expect(formatRelative(ago(10_000), now, "en")).toBe("now")
  expect(formatRelative(ago(12 * 60_000), now, "en")).toBe("12 minutes ago")
  expect(formatRelative(ago(3 * h), now, "en")).toBe("3 hours ago")
  expect(formatRelative(ago(48 * h), now, "en")).toBe("2 days ago")
  expect(formatRelative(ago(3 * h), now, "ar")).toBe("قبل 3 ساعات")
  expect(formatRelative(ago(40 * 24 * h), now, "en")).toBe("Aug 25, 2026")
})

it("resolves plural keys for 0, 1, 2, 5, 11 and 100", () => {
  const forms = ["zero", "one", "two", "few", "many", "other"]
  const common = Object.fromEntries(forms.map((f) => [`n_${f}`, f]))
  const ar = createI18n("ar", { common })
  // i18next also uses an explicit `_zero` key in English, so English only defines one and other
  const en = createI18n("en", { common: { n_one: "one", n_other: "other" } })
  const counts = [0, 1, 2, 5, 11, 100]
  expect(counts.map((count) => ar.t("n", { count }))).toEqual(forms)
  expect(counts.map((count) => en.t("n", { count }))).toEqual([
    "other",
    "one",
    "other",
    "other",
    "other",
    "other",
  ])
})

it("clamps", () => {
  expect([clamp(5, 0, 3), clamp(-1, 0, 3), clamp(2, 0, 3)]).toEqual([3, 0, 2])
})
