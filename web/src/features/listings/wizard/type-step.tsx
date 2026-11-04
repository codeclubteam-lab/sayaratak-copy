import { useQuery } from "@tanstack/react-query"
import { useFormContext } from "react-hook-form"

import { ChipMultiSelect } from "@/components/app/chip-multi-select"
import { ChipSingleSelect } from "@/components/app/chip-single-select"
import { taxonomyQuery } from "@/features/listings/queries"
import { useT } from "@/lib/i18n/use-t"
import { toast } from "@/components/ui/toast"
import {
  applyTile,
  detailsTouched,
  tileOf,
  tiles,
  type Tile,
} from "./type-change"
import { TypeTiles } from "./type-tiles"
import { useStepFields } from "./use-step-fields"

// Step `type`: what is being posted, then the one follow-up that type needs.
export function TypeStep() {
  const { t, locale } = useT()
  const { getValues } = useFormContext()
  const { values, error, set } = useStepFields()
  const { data: tax } = useQuery(taxonomyQuery)
  const current = tileOf(values)

  // Applies at once. When details were already filled in, some may be cleared, so the toast offers Undo instead of a dialog asking first.
  const choose = (tile: Tile) => {
    if (tile === current) return
    const before = getValues()
    const next = applyTile(before, tile, tax?.makes ?? [])
    const changed = Object.keys(next).filter(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(next[field])
    )
    for (const field of changed) set(field, next[field])
    if (current !== null && detailsTouched(before))
      toast.add({
        title: t("post.type_changed"),
        actionProps: {
          children: t("common.undo"),
          onClick: () => {
            for (const field of changed) set(field, before[field])
          },
        },
      })
  }
  const enabled = new Set(
    tax?.vehicleTypes.filter((v) => v.enabled).map((v) => v.id)
  )
  const shown = tiles.filter((x) => !tax || x === "part" || enabled.has(x))
  const label = (name: { en: string; ar: string }) => name[locale]

  return (
    <>
      <TypeTiles
        tiles={shown}
        value={current}
        onChange={choose}
        error={error("vehicleType")}
      />
      {values.kind === "vehicle" && values.vehicleType && (
        <ChipSingleSelect
          legend={t("post.intent_legend")}
          options={[
            { value: "sale", label: t("listing.sale") },
            { value: "rent", label: t("listing.rent") },
          ]}
          value={values.intent}
          onChange={(v) => {
            set("intent", v)
            if (v === "sale") set("rentPeriod", null)
          }}
        />
      )}
      {values.kind === "part" && (
        <>
          <ChipSingleSelect
            legend={t("search.part_category")}
            options={(tax?.partCategories ?? [])
              .map((c) => ({ value: c.id, label: label(c.name) }))
              .sort((a, b) => a.label.localeCompare(b.label, locale))}
            value={values.partCategoryId}
            onChange={(v) => set("partCategoryId", v)}
            error={error("partCategoryId")}
          />
          <ChipMultiSelect
            legend={t("post.fits")}
            options={(tax?.vehicleTypes ?? [])
              .filter((v) => v.enabled)
              .map((v) => ({ value: v.id, label: label(v.name) }))}
            value={values.compatibleTypes}
            onChange={(v) => set("compatibleTypes", v)}
            error={error("compatibleTypes")}
          />
        </>
      )}
    </>
  )
}
