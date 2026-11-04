import { useQuery } from "@tanstack/react-query"

import type { Spec } from "@/components/app/specs-list"
import { formatDate, formatNumber, formatPrice } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import {
  featureGroups,
  featureGroupsFor,
} from "@sayaratak/shared/schemas/listing-fields"
import { taxonomyQuery } from "./queries"
import {
  labelKey,
  partSections,
  vehicleSections,
  type FieldDef,
} from "./wizard/details-sections"

export type SpecGroup = { id: string; title: string; items: Spec[] }
export type FeatureGroup = { id: string; title: string; names: string[] }

// Fields the listing page already shows in its overview, in its own words, or merges into another row.
const shownElsewhere = [
  "year",
  "fuel",
  "transmission",
  "mileageKm",
  "engineCc",
  "payloadTons",
  "color",
  "warrantyMonths",
]
const empty = (v: unknown) =>
  v == null || v === "" || (Array.isArray(v) && v.length === 0)

// The step 7.9 fields of a listing, as groups for the detail page: one group per wizard section, empty fields and empty groups left out. `overview` is the older rows (make, model, year...), which stay first. Features come apart, as chips.
export function useSpecGroups(l: Listing, overview: Spec[]) {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const sections = l.kind === "part" ? partSections : vehicleSections
  const field: Record<string, unknown> = { ...l }
  const cityName = (id: string) =>
    tax?.cities.find((c) => c.id === id)?.name[locale] ?? id
  const makeNames = l.compatibleMakeIds
    .map((id) => tax?.makes.find((m) => m.id === id)?.name[locale])
    .filter(Boolean)

  const show = (def: FieldDef): Spec["value"] => {
    const value = field[def.name]
    switch (def.kind) {
      case "yesno":
        return t(value ? "form.yes" : "form.no")
      case "select":
        return t(def.keyOf?.(String(value)) ?? String(value))
      case "year":
        return String(value)
      case "date":
        return formatDate(`${String(value)}T00:00:00`, locale)
      case "city":
        return cityName(String(value))
      case "text":
        return <bdi>{String(value)}</bdi>
      default: {
        const n = Number(value)
        if (def.name === "previousOwners" && n === 0)
          return t("listing.first_owner")
        if (def.name === "minRent" && l.rentPeriod)
          return t(`listing.rent_${l.rentPeriod}`, { count: n })
        return def.money
          ? `${formatPrice(n, locale).amount} ${formatPrice(n, locale).unit}`
          : formatNumber(n, locale)
      }
    }
  }

  const groups: SpecGroup[] = sections.flatMap((section) => {
    const items: Spec[] = []
    for (const item of section.items) {
      if (typeof item === "string") {
        if (item === "fitsMakes" && makeNames.length > 0)
          items.push({
            label: t("form.compatible_make_ids"),
            value: makeNames.join(", "),
          })
        continue
      }
      if (shownElsewhere.includes(item.name) || empty(field[item.name]))
        continue
      const value = show(item)
      // A warranty reads with its length: "Dealer warranty, 12 months".
      items.push({
        label: t(labelKey(item)),
        value:
          item.name === "warranty" && l.warrantyMonths
            ? `${String(value)}, ${t("listing.rent_month", { count: l.warrantyMonths })}`
            : value,
      })
    }
    const rows = section.id === "basics" ? [...overview, ...items] : items
    return rows.length > 0
      ? [{ id: section.id, title: t(section.title), items: rows }]
      : []
  })

  const features: FeatureGroup[] = featureGroupsFor(l.vehicleType)
    .map((id) => ({
      id,
      title: t(`spec.group_${id}`),
      names: featureGroups[id]
        .filter((f) => l.features.some((have) => have === f))
        .map((f) => t(`feature.${f}`)),
    }))
    .filter((g) => g.names.length > 0)
  return { groups, features }
}
