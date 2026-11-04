import type { FieldValues } from "react-hook-form"

import { detailsDefaults } from "./wizard-defaults"

// Where each details field applies: the vehicle types (and "part"), the intent, and a condition on other fields. One table drives what the details step shows, what a change of type empties and what a listing sends, so the three never disagree. A field with no rule applies to everyone.
type Kind = "car" | "truck" | "motorcycle" | "tuk_tuk" | "rickshaw" | "part"
type Rule = {
  on: readonly Kind[]
  intent?: "sale" | "rent"
  when?: (v: FieldValues) => boolean
}

const vehicles = ["car", "truck", "motorcycle", "tuk_tuk", "rickshaw"] as const
const heavyOrCar = ["car", "truck"] as const
const engined = ["car", "truck", "motorcycle"] as const
const everything = [...vehicles, "part"] as const
const part = ["part"] as const

const used = (v: FieldValues) => v.condition === "used"
const registered = (v: FieldValues) => v.registered === true
const warranted = (v: FieldValues) => !!v.warranty && v.warranty !== "none"

export const fieldRules: Record<string, Rule> = {
  // Older fields
  year: { on: vehicles },
  mileageKm: { on: vehicles, when: used },
  fuel: { on: vehicles },
  color: { on: vehicles },
  transmission: { on: heavyOrCar },
  engineCc: { on: vehicles },
  payloadTons: { on: ["truck"] },
  partNumber: { on: part },
  rentPeriod: { on: everything, intent: "rent" },
  // Basics and engine
  trim: { on: vehicles },
  bodyType: { on: vehicles },
  colorInterior: { on: heavyOrCar },
  origin: { on: everything },
  cylinders: { on: engined },
  horsepower: { on: engined },
  driveType: { on: heavyOrCar },
  strokes: { on: ["motorcycle"] },
  starter: { on: ["motorcycle"] },
  // Capacity
  doors: { on: ["car"] },
  seats: { on: vehicles },
  axles: { on: ["truck"] },
  grossWeightTons: { on: ["truck"] },
  cabType: { on: ["truck"] },
  // History
  previousOwners: { on: vehicles, when: used },
  accidentFree: { on: vehicles, when: used },
  paint: { on: heavyOrCar, when: used },
  serviceHistory: { on: vehicles, when: used },
  warranty: { on: everything },
  warrantyMonths: { on: everything, when: warranted },
  // Papers
  customsCleared: { on: vehicles },
  registered: { on: vehicles },
  plateType: { on: vehicles, when: registered },
  plateCityId: { on: vehicles, when: registered },
  licenseValidUntil: { on: vehicles, when: registered },
  insurance: { on: vehicles },
  chassisNumber: { on: vehicles },
  // Deal
  exchange: { on: vehicles, intent: "sale" },
  financing: { on: vehicles, intent: "sale" },
  testDrive: { on: vehicles },
  inspectionReport: { on: vehicles },
  // Rent terms (delivery is also a spare part's)
  driver: { on: heavyOrCar, intent: "rent" },
  minRent: { on: vehicles, intent: "rent" },
  deposit: { on: vehicles, intent: "rent" },
  kmLimitPerDay: { on: vehicles, intent: "rent" },
  insuranceIncluded: { on: vehicles, intent: "rent" },
  fuelPolicy: { on: vehicles, intent: "rent" },
  delivery: {
    on: everything,
    when: (v) => v.kind === "part" || v.intent === "rent",
  },
  minDriverAge: { on: vehicles, intent: "rent" },
  licenseYears: { on: vehicles, intent: "rent" },
  features: { on: vehicles },
  // Spare parts
  partBrand: { on: part },
  partType: { on: part },
  partPosition: { on: part },
  quantity: { on: part },
  compatibleMakeIds: { on: part },
  fitsYearFrom: { on: part },
  fitsYearTo: { on: part },
  dimensions: { on: part },
  weightKg: { on: part },
  installation: { on: part },
  returns: { on: part },
}

const kindOf = (v: FieldValues): string | null =>
  v.kind === "part" ? "part" : (v.vehicleType ?? null)

export function applies(field: string, v: FieldValues) {
  const rule = fieldRules[field]
  if (!rule) return true
  const kind = kindOf(v)
  return (
    kind !== null &&
    (rule.on as readonly string[]).includes(kind) &&
    (!rule.intent ||
      // A rent-only rule also needs a rent listing; sale-only the reverse. A part is always for sale.
      v.intent === rule.intent) &&
    (!rule.when || rule.when(v))
  )
}

const sameValue = (a: unknown, b: unknown) =>
  JSON.stringify(a ?? null) === JSON.stringify(b ?? null)

// The details fields that do not apply to these values but still hold something, with the value each goes back to.
export function inapplicable(v: FieldValues): FieldValues {
  const out: FieldValues = {}
  for (const [field, empty] of Object.entries(detailsDefaults))
    if (!applies(field, v) && !sameValue(v[field], empty)) out[field] = empty
  return out
}
