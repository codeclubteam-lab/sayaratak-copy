import type { Listing } from "@sayaratak/shared/schemas/listing"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import type { Taxonomy } from "@sayaratak/shared/schemas/taxonomy"

export type Titled = Pick<
  Listing,
  | "title"
  | "kind"
  | "makeId"
  | "modelId"
  | "makeOther"
  | "modelOther"
  | "year"
  | "partCategoryId"
>

// A seller types the title in one language, so every page builds it from the taxonomy instead ("Toyota Corolla 2018", "Brakes · Toyota") in the page language. The typed title is the fallback until the taxonomy arrives.
export function listingTitle(
  l: Titled,
  tax: Taxonomy | undefined,
  locale: Locale
) {
  if (!tax) return l.title
  const make = l.makeId
    ? tax.makes.find((m) => m.id === l.makeId)?.name[locale]
    : l.makeOther
  if (l.kind === "part") {
    const category = tax.partCategories.find((c) => c.id === l.partCategoryId)
      ?.name[locale]
    return [category, make].filter(Boolean).join(" · ") || l.title
  }
  const model = l.modelId
    ? tax.models.find((m) => m.id === l.modelId)?.name[locale]
    : l.modelOther
  return [make, model, l.year].filter(Boolean).join(" ") || l.title
}
