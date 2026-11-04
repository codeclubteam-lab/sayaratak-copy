import type { Bilingual } from "@sayaratak/shared/schemas/fields"
import type { Locale } from "@sayaratak/shared/schemas/locale"

const pageSize = 24

// The location lists are small and fetched whole, so search, A to Z order and paging happen here. ponytail: move to the mock with `listPage` if a list grows past a few thousand rows.
export function pageRows<T extends { name: Bilingual }>(
  rows: T[] | undefined,
  { q, page }: { q?: string; page: number },
  locale: Locale
) {
  if (!rows) return undefined
  const text = q?.trim().toLowerCase()
  const kept = rows
    .filter(
      (r) => !text || `${r.name.ar} ${r.name.en}`.toLowerCase().includes(text)
    )
    .sort((a, b) => a.name[locale].localeCompare(b.name[locale], locale))
  return {
    items: kept.slice((page - 1) * pageSize, page * pageSize),
    total: kept.length,
    pageSize,
  }
}
