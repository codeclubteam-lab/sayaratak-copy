import { useQuery } from "@tanstack/react-query"

import { formatMileage, formatNumber } from "@/lib/format"
import { useT } from "@/lib/i18n/use-t"
import type { Listing } from "@sayaratak/shared/schemas/listing"
import { MakeLogo } from "@/components/app/make-logo"
import type { Spec } from "@/components/app/specs-list"
import { taxonomyQuery } from "./queries"
import { listingColors } from "@sayaratak/shared/listings/schemas"

// `gold` is not in the post form, but older listings use it.
const knownColors: string[] = [...listingColors, "gold"]

// The few facts shown above the fold (`facts`) and the full list (`specs`), both without the empty ones.
export function useListingFacts(l: Listing) {
  const { t, locale } = useT()
  const { data: tax } = useQuery(taxonomyQuery)
  const make = l.makeId
    ? tax?.makes.find((m) => m.id === l.makeId)?.name[locale]
    : l.makeOther
  const model = l.modelId
    ? tax?.models.find((m) => m.id === l.modelId)?.name[locale]
    : l.modelOther
  const type = tax?.vehicleTypes.find((v) => v.id === l.vehicleType)?.name[
    locale
  ]
  const category = tax?.partCategories.find((c) => c.id === l.partCategoryId)
    ?.name[locale]
  const fits = l.compatibleTypes
    .map((id) => tax?.vehicleTypes.find((v) => v.id === id)?.name[locale])
    .filter(Boolean)
    .join(", ")
  const latin = (value?: string | null) => value && <bdi>{value}</bdi>
  const makeCell = make && (
    <span className="inline-flex items-center gap-2">
      <MakeLogo id={l.makeId} />
      <bdi>{make}</bdi>
    </span>
  )
  const item = (label: string, value: Spec["value"]): Spec | null =>
    value ? { label, value } : null
  const list = (items: (Spec | null)[]) => items.filter((i) => i !== null)

  const year = item(t("listing.spec_year"), l.year?.toString())
  const mileage = item(
    t("listing.spec_mileage"),
    l.mileageKm == null ? null : formatMileage(l.mileageKm, locale)
  )
  const fuel = item(t("listing.spec_fuel"), l.fuel && t(`fuel.${l.fuel}`))
  const gearbox = item(
    t("listing.spec_transmission"),
    l.transmission && t(`transmission.${l.transmission}`)
  )
  const condition = item(
    t("listing.spec_condition"),
    t(`condition.${l.condition}`)
  )
  const payload = item(
    t("listing.spec_payload"),
    l.payloadTons != null &&
      t("listing.payload_value", { tons: formatNumber(l.payloadTons, locale) })
  )

  if (l.kind === "part") {
    const partCategory = item(t("listing.spec_category"), latin(category))
    const partMake = item(t("listing.spec_make"), makeCell)
    return {
      facts: list([condition, partCategory, partMake]),
      specs: list([
        partCategory,
        partMake,
        condition,
        item(t("listing.spec_fits"), fits),
      ]),
    }
  }
  return {
    facts: list([year, mileage, fuel, gearbox, condition, payload]),
    specs: list([
      item(t("listing.spec_make"), makeCell),
      item(t("listing.spec_model"), latin(model)),
      item(t("listing.spec_type"), type),
      year,
      condition,
      mileage,
      fuel,
      gearbox,
      item(
        t("listing.spec_color"),
        l.color &&
          (knownColors.includes(l.color) ? t(`color.${l.color}`) : l.color)
      ),
      item(
        t("listing.spec_engine"),
        l.engineCc != null &&
          t("listing.engine_value", { cc: formatNumber(l.engineCc, locale) })
      ),
      payload,
    ]),
  }
}
