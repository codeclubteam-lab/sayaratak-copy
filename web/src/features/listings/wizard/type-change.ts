import type { FieldValues } from "react-hook-form"

import type { Taxonomy } from "@sayaratak/shared/schemas/taxonomy"
import type { VehicleType } from "@sayaratak/shared/schemas/listing"
import { inapplicable } from "./field-rules"
import { detailsDefaults } from "./wizard-defaults"

// One tile per type: the five vehicle types and spare parts.
export type Tile = VehicleType | "part"
export const tiles: Tile[] = [
  "car",
  "truck",
  "motorcycle",
  "tuk_tuk",
  "rickshaw",
  "part",
]

export const tileOf = (values: FieldValues): Tile | null =>
  values.kind === "part" ? "part" : (values.vehicleType ?? null)

// A part is always for sale. Details that do not apply to the new type go back to their defaults, and so do make and model when that make does not come in the new vehicle type. The rest (title, description, price, photos) stays.
export function applyTile(
  values: FieldValues,
  tile: Tile,
  makes: Taxonomy["makes"]
): FieldValues {
  const part = tile === "part"
  const next: FieldValues = {
    ...values,
    kind: part ? "part" : "vehicle",
    vehicleType: part ? null : tile,
    intent: part ? "sale" : values.intent,
    partCategoryId: part ? values.partCategoryId : null,
    compatibleTypes: part ? values.compatibleTypes : [],
  }
  Object.assign(next, inapplicable(next))
  const make = makes.find((m) => m.id === next.makeId)
  if (!part && make && !make.vehicleTypes.includes(tile)) {
    next.makeId = null
    next.modelId = null
  }
  return next
}

const blank = (v: unknown) =>
  v == null || v === "" || (Array.isArray(v) && v.length === 0)

// True once any details field differs from its default.
export const detailsTouched = (values: FieldValues) =>
  Object.entries(detailsDefaults).some(([field, empty]) => {
    const value: unknown = values[field]
    return (
      !(blank(value) && blank(empty)) &&
      JSON.stringify(value) !== JSON.stringify(empty)
    )
  })
