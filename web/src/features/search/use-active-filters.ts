import { useQuery } from "@tanstack/react-query"

import { taxonomyQuery } from "@/features/listings/queries"
import { formatMileage, formatPrice } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import {
  flagKeys,
  flagLabel,
  listKeys,
  listPrefix,
  type SearchParams,
} from "@sayaratak/shared/search/schemas"

const dropOne = (list: string[] | undefined, value: string) => {
  const rest = (list ?? []).filter((x) => x !== value)
  return rest.length ? rest : undefined
}

export type ActiveFilter = { id: string; label: string; next: SearchParams }

// One removable chip per active filter. `next` is the URL params with only that filter gone.
export function useActiveFilters(params: SearchParams): ActiveFilter[] {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const out: ActiveFilter[] = []
  const add = (id: string, label: string, ...drop: (keyof SearchParams)[]) => {
    const next: SearchParams = { ...params, page: 1 }
    for (const k of drop) delete next[k]
    if (!next.lat && next.sort === "nearest") next.sort = "relevance"
    out.push({ id, label, next })
  }
  const name = (
    list: { id: string; name: { ar: string; en: string } }[] | undefined,
    id: string
  ) => list?.find((x) => x.id === id)?.name[locale] ?? id
  const money = (n: number) => {
    const { amount, unit } = formatPrice(n, locale)
    return `${amount} ${unit}`
  }
  const range = (
    min: number | undefined,
    max: number | undefined,
    fmt: (n: number) => string
  ) =>
    min !== undefined && max !== undefined
      ? t("search.chip_range", { from: fmt(min), to: fmt(max) })
      : min !== undefined
        ? t("search.chip_from", { value: fmt(min) })
        : t("search.chip_to", { value: fmt(max ?? 0) })

  if (params.q) add("q", params.q, "q")
  if (params.type) add("type", name(tax?.vehicleTypes, params.type), "type")
  if (params.partCategory)
    add(
      "partCategory",
      name(tax?.partCategories, params.partCategory),
      "partCategory"
    )
  if (params.make) add("make", name(tax?.makes, params.make), "make", "model")
  if (params.model) add("model", name(tax?.models, params.model), "model")
  if (params.minPrice !== undefined || params.maxPrice !== undefined)
    add(
      "price",
      range(params.minPrice, params.maxPrice, money),
      "minPrice",
      "maxPrice"
    )
  if (params.minYear !== undefined || params.maxYear !== undefined)
    add(
      "year",
      range(params.minYear, params.maxYear, String),
      "minYear",
      "maxYear"
    )
  if (params.maxMileage !== undefined)
    add(
      "mileage",
      t("search.chip_to", { value: formatMileage(params.maxMileage, locale) }),
      "maxMileage"
    )
  for (const f of params.fuel ?? []) {
    const next = (params.fuel ?? []).filter((x) => x !== f)
    out.push({
      id: `fuel-${f}`,
      label: t(`fuel.${f}`),
      next: { ...params, page: 1, fuel: next.length ? next : undefined },
    })
  }
  for (const f of params.transmission ?? []) {
    const next = (params.transmission ?? []).filter((x) => x !== f)
    out.push({
      id: `transmission-${f}`,
      label: t(`transmission.${f}`),
      next: {
        ...params,
        page: 1,
        transmission: next.length ? next : undefined,
      },
    })
  }
  if (params.condition)
    add("condition", t(`condition.${params.condition}`), "condition")
  if (params.city)
    add("city", name(tax?.cities, params.city), "city", "district")
  if (params.district)
    add("district", name(tax?.districts, params.district), "district")
  if (params.radius)
    add(
      "radius",
      t("search.radius_value", { km: params.radius }),
      "radius",
      "lat",
      "lng"
    )
  // Step 7.9 filters: one chip per chosen value of a list, one per yes-only flag, one each for the two numbers.
  for (const key of listKeys)
    for (const v of params[key] ?? [])
      out.push({
        id: `${key}-${v}`,
        label: t(`spec.${listPrefix[key]}_${v === "other" ? "misc" : v}`),
        next: { ...params, page: 1, [key]: dropOne(params[key], v) },
      })
  for (const f of params.features ?? [])
    out.push({
      id: `features-${f}`,
      label: t(`feature.${f}`),
      next: {
        ...params,
        page: 1,
        features: dropOne(params.features, f),
      },
    })
  if (params.seatsMin !== undefined)
    add(
      "seatsMin",
      t("search.chip_seats", { seats: params.seatsMin }),
      "seatsMin"
    )
  if (params.fitsYear !== undefined)
    add(
      "fitsYear",
      t("search.chip_fits_year", { year: params.fitsYear }),
      "fitsYear"
    )
  for (const k of flagKeys) if (params[k]) add(k, t(flagLabel[k]), k)
  if (params.verifiedOnly)
    add("verifiedOnly", t("search.verified_only"), "verifiedOnly")
  if (params.hasVideo) add("hasVideo", t("search.has_video"), "hasVideo")
  if (params.featured) add("featured", t("search.featured_only"), "featured")
  if (params.includeSold) {
    const next = { ...params, page: 1, includeSold: false }
    out.push({ id: "includeSold", label: t("search.include_sold"), next })
  }
  return out
}
