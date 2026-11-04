import type { FieldValues } from "react-hook-form"

import {
  bodyTypes,
  specOptions,
} from "@sayaratak/shared/schemas/listing-fields"
import {
  fuelSchema,
  transmissionSchema,
} from "@sayaratak/shared/schemas/listing"
import { listingColors } from "@sayaratak/shared/listings/schemas"

// What the details step shows: sections of fields. A field is data here (its kind, range and choices), so one renderer draws all of them; where a field applies comes from `field-rules.ts`. A few items are drawn by their own component.
export type FieldDef = {
  name: string
  // Label key; `form.<name in snake case>` when left out.
  label?: string
  kind:
    "select" | "year" | "int" | "number" | "text" | "yesno" | "date" | "city"
  options?: readonly string[] | ((v: FieldValues) => readonly string[])
  // Key of a choice's label, given its value.
  keyOf?: (value: string) => string
  // The choice is stored as a number (cylinders and the like).
  numeric?: boolean
  min?: number
  max?: number
  step?: number
  money?: boolean
  required?: boolean
  // What an empty text field stores: null, or "" for the older `partNumber`.
  blank?: "" | null
  dir?: "ltr" | "auto"
  // Label key of a line under the field.
  hint?: string
  // Takes the whole row of the grid.
  full?: boolean
}
export type Custom =
  | "makeModel"
  | "condition"
  | "features"
  | "fitsMakes"
  | "title"
  | "description"
  | "price"
export type Item = FieldDef | Custom
export type Section = {
  id: string
  title: string
  // Opens with the page; the rest start closed.
  open?: boolean
  // Marks its fields optional once, in the heading, instead of on every label.
  optional?: boolean
  items: Item[]
}

// A key may not end in a plural suffix (`_other`), so "other" is stored as `misc`.
const snake = (name: string) =>
  name.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
// Label key of a field: its own, or `form.<name in snake case>`.
export const labelKey = (def: FieldDef) =>
  def.label ?? `form.${snake(def.name)}`

const spec = (prefix: string) => (value: string) =>
  `spec.${prefix}_${value === "other" ? "misc" : value}`
const pick = (
  name: string,
  options: FieldDef["options"],
  prefix: string,
  more: Partial<FieldDef> = {}
): FieldDef => ({
  name,
  kind: "select",
  options,
  keyOf: spec(prefix),
  ...more,
})
const int = (
  name: string,
  min: number,
  max: number,
  more: Partial<FieldDef> = {}
): FieldDef => ({ name, kind: "int", min, max, ...more })
const num = (name: string, max: number, step = 0.5): FieldDef => ({
  name,
  kind: "number",
  min: 0,
  max,
  step,
})
const text = (name: string, more: Partial<FieldDef> = {}): FieldDef => ({
  name,
  kind: "text",
  ...more,
})
const yes = (name: string): FieldDef => ({ name, kind: "yesno" })
const year = (name: string, more: Partial<FieldDef> = {}): FieldDef => ({
  name,
  kind: "year",
  ...more,
})

const bodyByType = new Map<unknown, readonly string[]>(
  Object.entries(bodyTypes)
)
const bodyOptions = (v: FieldValues) => bodyByType.get(v.vehicleType) ?? []
const colorOf = (value: string) => `color.${value}`

const warranty = [
  pick("warranty", specOptions.warranty, "warranty"),
  int("warrantyMonths", 1, 120),
]

export const vehicleSections: Section[] = [
  {
    id: "basics",
    title: "post.section_basics",
    open: true,
    items: [
      "makeModel",
      year("year", { required: true }),
      "condition",
      pick("bodyType", bodyOptions, "body"),
      text("trim", { dir: "auto" }),
      pick("color", listingColors, "color", { keyOf: colorOf }),
      pick("colorInterior", listingColors, "color", { keyOf: colorOf }),
      pick("origin", specOptions.origin, "origin"),
    ],
  },
  {
    id: "engine",
    title: "post.section_engine",
    open: true,
    items: [
      pick("fuel", fuelSchema.options, "fuel", {
        keyOf: (o) => `fuel.${o}`,
        required: true,
      }),
      pick("transmission", transmissionSchema.options, "transmission", {
        keyOf: (o) => `transmission.${o}`,
        required: true,
      }),
      int("mileageKm", 0, 2_000_000, {
        label: "form.mileage",
        required: true,
      }),
      int("engineCc", 20, 20_000, { label: "form.engine_cc" }),
      int("cylinders", 1, 16),
      int("horsepower", 1, 2000),
      pick("driveType", specOptions.driveType, "drive"),
      pick("strokes", ["2", "4"], "strokes", { numeric: true }),
      pick("starter", specOptions.starter, "starter"),
    ],
  },
  {
    id: "capacity",
    title: "post.section_capacity",
    optional: true,
    items: [
      int("doors", 2, 6),
      int("seats", 1, 60),
      num("payloadTons", 100),
      int("axles", 2, 10),
      num("grossWeightTons", 100),
      pick("cabType", specOptions.cabType, "cab"),
    ],
  },
  {
    id: "history",
    title: "post.section_history",
    optional: true,
    items: [
      int("previousOwners", 0, 9),
      yes("accidentFree"),
      pick("paint", specOptions.paint, "paint"),
      pick("serviceHistory", specOptions.serviceHistory, "service"),
      ...warranty,
    ],
  },
  {
    id: "papers",
    title: "post.section_papers",
    optional: true,
    items: [
      yes("customsCleared"),
      yes("registered"),
      pick("plateType", specOptions.plateType, "plate"),
      { name: "plateCityId", kind: "city" },
      { name: "licenseValidUntil", kind: "date" },
      pick("insurance", specOptions.insurance, "insurance"),
      text("chassisNumber", { dir: "ltr" }),
    ],
  },
  {
    id: "deal",
    title: "post.section_deal",
    optional: true,
    items: [
      yes("exchange"),
      yes("financing"),
      yes("testDrive"),
      yes("inspectionReport"),
    ],
  },
  {
    id: "rent",
    title: "post.section_rent",
    open: true,
    items: [
      pick("driver", specOptions.driver, "driver"),
      int("minRent", 1, 365),
      int("deposit", 0, 9_999_999_999, { money: true }),
      int("kmLimitPerDay", 10, 2000, { hint: "form.km_limit_hint" }),
      yes("insuranceIncluded"),
      pick("fuelPolicy", specOptions.fuelPolicy, "fuel_policy"),
      yes("delivery"),
      int("minDriverAge", 18, 70),
      int("licenseYears", 0, 30),
    ],
  },
  {
    id: "features",
    title: "post.section_features",
    optional: true,
    items: ["features"],
  },
  {
    id: "listing",
    title: "post.section_listing",
    open: true,
    items: ["title", "description", "price"],
  },
]

export const partSections: Section[] = [
  {
    id: "basics",
    title: "post.section_basics",
    open: true,
    items: [
      "condition",
      pick("partType", specOptions.partType, "part_type"),
      text("partBrand", { dir: "auto" }),
      text("partNumber", { dir: "ltr", blank: "" }),
      pick("partPosition", specOptions.partPosition, "position"),
      int("quantity", 1, 9999),
      pick("origin", specOptions.origin, "origin"),
    ],
  },
  {
    id: "fits",
    title: "post.section_fits",
    open: true,
    items: ["makeModel", "fitsMakes", year("fitsYearFrom"), year("fitsYearTo")],
  },
  {
    id: "partdetails",
    title: "post.section_part_details",
    optional: true,
    items: [
      ...warranty,
      text("dimensions", { dir: "auto" }),
      num("weightKg", 5000, 0.1),
    ],
  },
  {
    id: "service",
    title: "post.section_service",
    optional: true,
    items: [yes("installation"), yes("delivery"), yes("returns")],
  },
  {
    id: "listing",
    title: "post.section_listing",
    open: true,
    items: ["title", "description", "price"],
  },
]
