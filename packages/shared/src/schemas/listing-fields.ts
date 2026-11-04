import { z } from "zod"

import { optionalInt, yearSchema } from "./fields"

// The listing fields added in step 7.9: specs, history, papers, deal and rent terms, features, and what a spare part needs. All are optional (null, or an empty list), flat on the listing like the older fields, and spread into the listing, its input and the wizard's details schema. Enum values are English; labels come from `spec.*` keys.

// A body type belongs to a vehicle type. The same word in two types is one value.
export const bodyTypes = {
  car: [
    "sedan",
    "hatchback",
    "suv",
    "crossover",
    "coupe",
    "convertible",
    "wagon",
    "pickup",
    "van",
    "minivan",
  ],
  truck: [
    "flatbed",
    "tipper",
    "box",
    "tanker",
    "refrigerated",
    "tow",
    "container",
    "pickup",
    "other",
  ],
  motorcycle: [
    "scooter",
    "standard",
    "sport",
    "cruiser",
    "off_road",
    "touring",
  ],
  tuk_tuk: ["passenger", "cargo"],
  rickshaw: ["passenger", "cargo"],
} as const

const values = <T extends string>(list: readonly T[]) =>
  [...new Set(list)] as [T, ...T[]]

// Choices of each select. The first word of a label key is the field (`spec.drive_fwd`).
export const specOptions = {
  origin: ["gcc", "japan", "usa", "europe", "korea", "china", "local", "other"],
  driveType: ["fwd", "rwd", "awd", "four_wd"],
  starter: ["electric", "kick", "both"],
  cabType: ["single", "double", "crew", "sleeper"],
  paint: ["original", "partial", "full"],
  serviceHistory: ["full", "partial", "none"],
  warranty: ["none", "dealer", "manufacturer"],
  plateType: ["private", "commercial", "taxi", "government"],
  insurance: ["none", "third_party", "comprehensive"],
  driver: ["included", "optional", "not_available"],
  fuelPolicy: ["full_to_full", "included", "renter_pays"],
  partType: ["genuine", "aftermarket"],
  partPosition: ["front", "rear", "left", "right", "universal"],
} as const

// Features, grouped as the form shows them. A car shows safety, comfort, tech and exterior; a truck adds work; a motorcycle, tuk-tuk and rickshaw show bike.
export const featureGroups = {
  safety: [
    "abs",
    "airbags_front",
    "airbags_side",
    "airbags_curtain",
    "esc",
    "traction_control",
    "parking_sensors",
    "rear_camera",
    "camera_360",
    "blind_spot",
    "lane_assist",
    "cruise_control",
    "adaptive_cruise",
    "immobilizer",
    "alarm",
    "tracker",
  ],
  comfort: [
    "air_conditioning",
    "climate_control",
    "rear_ac",
    "power_windows",
    "power_mirrors",
    "power_steering",
    "power_seats",
    "heated_seats",
    "cooled_seats",
    "leather_seats",
    "memory_seats",
    "sunroof",
    "panoramic_roof",
    "keyless_entry",
    "push_start",
    "remote_start",
    "electric_tailgate",
    "third_row",
    "auto_headlights",
    "rain_sensor",
  ],
  tech: [
    "touchscreen",
    "bluetooth",
    "usb",
    "navigation",
    "carplay",
    "android_auto",
    "premium_audio",
    "rear_entertainment",
    "wireless_charging",
    "head_up_display",
    "digital_cluster",
  ],
  exterior: [
    "alloy_wheels",
    "fog_lights",
    "led_headlights",
    "xenon_headlights",
    "roof_rails",
    "tow_hitch",
    "tinted_windows",
    "spoiler",
    "running_boards",
    "bull_bar",
    "spare_wheel",
  ],
  work: [
    "winch",
    "pto",
    "tipping_gear",
    "crane",
    "cooling_unit",
    "tail_lift",
    "sleeper_cab",
    "fleet_tracking",
  ],
  bike: [
    "electric_start",
    "abs",
    "disc_brakes",
    "luggage_box",
    "windshield",
    "led_lights",
    "alloy_wheels",
    "usb",
  ],
} as const
export type FeatureGroup = keyof typeof featureGroups

export const featureIds = values(Object.values(featureGroups).flat())

// The groups a vehicle type shows, in order. No type shows none.
export function featureGroupsFor(vehicleType: string | null): FeatureGroup[] {
  if (vehicleType === "car") return ["safety", "comfort", "tech", "exterior"]
  if (vehicleType === "truck")
    return ["safety", "comfort", "tech", "exterior", "work"]
  return vehicleType ? ["bike"] : []
}

const yesNo = z.boolean().nullable()
const text = (max: number) =>
  z.string().trim().max(max, "validation.too_long").nullable()
const pick = <T extends readonly [string, ...string[]]>(list: T) =>
  z.enum(list).nullable()
const tons = (max: number) =>
  z
    .number({ message: "validation.required" })
    .min(0, "validation.number")
    .max(max, "validation.too_large")
    .nullable()

// One key per field, in the order the sections show them.
export const extraFields = {
  trim: text(40),
  bodyType: pick(values(Object.values(bodyTypes).flat())),
  colorInterior: z.string().nullable(),
  origin: pick(specOptions.origin),
  cylinders: optionalInt(1, 16),
  horsepower: optionalInt(1, 2000),
  driveType: pick(specOptions.driveType),
  strokes: z.union([z.literal(2), z.literal(4)]).nullable(),
  starter: pick(specOptions.starter),
  doors: optionalInt(2, 6),
  seats: optionalInt(1, 60),
  axles: optionalInt(2, 10),
  grossWeightTons: tons(100),
  cabType: pick(specOptions.cabType),
  previousOwners: optionalInt(0, 9),
  accidentFree: yesNo,
  paint: pick(specOptions.paint),
  serviceHistory: pick(specOptions.serviceHistory),
  warranty: pick(specOptions.warranty),
  warrantyMonths: optionalInt(1, 120),
  customsCleared: yesNo,
  registered: yesNo,
  plateType: pick(specOptions.plateType),
  plateCityId: z.string().nullable(),
  licenseValidUntil: z.iso.date("validation.date").nullable(),
  insurance: pick(specOptions.insurance),
  chassisNumber: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{5,25}$/, "validation.chassis")
    .nullable(),
  exchange: yesNo,
  financing: yesNo,
  testDrive: yesNo,
  inspectionReport: yesNo,
  driver: pick(specOptions.driver),
  minRent: optionalInt(1, 365),
  deposit: optionalInt(0, 9_999_999_999),
  kmLimitPerDay: optionalInt(10, 2000),
  insuranceIncluded: yesNo,
  fuelPolicy: pick(specOptions.fuelPolicy),
  delivery: yesNo,
  minDriverAge: optionalInt(18, 70),
  licenseYears: optionalInt(0, 30),
  features: z.array(z.enum(featureIds)),
  partBrand: text(40),
  partType: pick(specOptions.partType),
  partPosition: pick(specOptions.partPosition),
  quantity: optionalInt(1, 9999),
  compatibleMakeIds: z.array(z.string()),
  fitsYearFrom: yearSchema.nullable(),
  fitsYearTo: yearSchema.nullable(),
  dimensions: text(80),
  weightKg: tons(5000),
  installation: yesNo,
  returns: yesNo,
}

const extraShape = z.object(extraFields)
export type ExtraFields = z.infer<typeof extraShape>

// What an untouched form holds for each field: null, or an empty list. Parsed, so the type follows the schema.
export const extraDefaults = extraShape.parse(
  Object.fromEntries(
    Object.entries(extraFields).map(([name, schema]) => [
      name,
      schema instanceof z.ZodArray ? [] : null,
    ])
  )
)
