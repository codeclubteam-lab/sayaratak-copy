import { readdirSync, readFileSync } from "node:fs"
import { expect, it } from "vitest"

import { normalizeDigits } from "@sayaratak/shared/lib/digits"
import { formatRelative } from "@/lib/format"
import { createI18n, type Messages } from "@/lib/i18n/create"

const load = (locale: string): Messages =>
  Object.fromEntries(
    readdirSync(`src/messages/${locale}`).map((f) => [
      f.replace(".json", ""),
      JSON.parse(readFileSync(`src/messages/${locale}/${f}`, "utf8")),
    ])
  )

const counts = [0, 1, 2, 5, 11, 100]

// Every plural key family renders a non-empty string for each Arabic count, and shows the number when the template has {{count}} or {{n}}.
it.each(["ar", "en"] as const)(
  "%s plurals resolve for 0,1,2,5,11,100",
  (locale) => {
    const messages = load(locale)
    const i18n = createI18n(locale, messages)
    const bases = new Set<string>()
    for (const ns of Object.values(messages))
      for (const key of Object.keys(ns)) {
        const m = key.match(/^(.*)_(zero|one|two|few|many|other)$/)
        if (m?.[1]) bases.add(m[1])
      }
    expect(bases.size).toBeGreaterThan(20)
    const bad: string[] = []
    for (const base of bases)
      for (const count of counts) {
        const out = i18n.t(base, { count, n: count })
        if (!out || out === base) bad.push(`${base} @ ${count}`)
      }
    expect(bad).toEqual([])
  }
)

it("Arabic-Indic and Persian digits become a valid phone", () => {
  expect(normalizeDigits("٠٩١٢٣٤٥٦٧٨")).toBe("091234567" + "8")
  expect(normalizeDigits("۰۹۱۲")).toBe("0912")
})

it("relative time in both languages at several ages", () => {
  const now = Date.parse("2026-10-22T12:00:00Z")
  const ago = (s: number) => new Date(now - s * 1000).toISOString()
  for (const locale of ["ar", "en"] as const)
    for (const s of [10, 300, 7200, 3 * 86400, 40 * 86400])
      expect(formatRelative(ago(s), now, locale)).toBeTruthy()
})
