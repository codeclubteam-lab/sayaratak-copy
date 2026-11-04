import type { Locale } from "@sayaratak/shared/schemas/locale"

export { cn } from "cn"

// Arabic is the only RTL locale; one place decides `dir`.
export const isRtl = (locale: Locale) => locale === "ar"

// Keeps a number inside a range (pagination, gallery index, rating).
export const clamp = (n: number, min: number, max: number) =>
  Math.min(Math.max(n, min), max)
