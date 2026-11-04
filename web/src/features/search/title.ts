import type { Locale } from "@sayaratak/shared/schemas/locale"
import type { Taxonomy } from "@sayaratak/shared/schemas/taxonomy"
import type { SearchParams } from "@sayaratak/shared/search/schemas"

export type Translate = (key: string, vars?: Record<string, string>) => string

// Message keys the title and description need, so a route's head() can build them on the server without a full i18n instance.
export const titleKeys = [
  "search.title_sale",
  "search.title_rent",
  "search.title_in_city",
  "search.all_vehicles",
  "search.all_parts",
  "search.parts_for",
  "search.description",
] as const

export const fill = (template: string, vars: Record<string, string> = {}) =>
  template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => vars[name] ?? "")

// "Cars for sale in Khartoum": the same text is the page heading, the <title> and the landing's own H1.
export function searchTitle(
  s: SearchParams,
  tax: Taxonomy | undefined,
  locale: Locale,
  t: Translate
) {
  const type = s.type
    ? tax?.vehicleTypes.find((v) => v.id === s.type)?.name[locale]
    : undefined
  const city = s.city
    ? tax?.cities.find((c) => c.id === s.city)?.name[locale]
    : undefined
  let title =
    s.kind === "part"
      ? type
        ? t("search.parts_for", { type })
        : t("search.all_parts")
      : (type ?? t("search.all_vehicles"))
  if (s.kind === "vehicle" && s.intent)
    title = t(`search.title_${s.intent}`, { what: title })
  return city ? t("search.title_in_city", { title, city }) : title
}
