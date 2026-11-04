import {
  bodyTypes,
  extraDefaults,
  featureGroups,
  featureGroupsFor,
  specOptions,
  type ExtraFields,
} from "@sayaratak/shared/schemas/listing-fields"
import type { Intent, VehicleType } from "@sayaratak/shared/schemas/listing"

// Specs, history, papers, deal and rent terms of a seeded listing. Every value comes from a hash of the listing's number, never from the seeded random generator, so adding a field moves no other number of the seed.
const hash = (n: number, salt: number) => {
  let x = (Math.imul(n + 1, 2654435761) + Math.imul(salt + 1, 40503)) >>> 0
  x = Math.imul(x ^ (x >>> 15), 2246822519) >>> 0
  x = Math.imul(x ^ (x >>> 13), 3266489917) >>> 0
  return (x ^ (x >>> 16)) >>> 0
}
const share = (n: number, salt: number, p: number) =>
  hash(n, salt) % 1000 < p * 1000
const from = <T>(n: number, salt: number, list: readonly T[]) =>
  list[hash(n, salt) % list.length] as T
// Yes about `p` of the time, otherwise not stated (a seller rarely writes "no").
const maybe = (n: number, salt: number, p: number) =>
  share(n, salt, p) ? true : share(n, salt + 1, 0.3) ? false : null

export type SpecInput = {
  n: number
  kind: "vehicle" | "part"
  type: VehicleType | null
  intent: Intent
  used: boolean
  year: number | null
  cityId: string
  makeId: string | null
  engineCc: number | null
}

export function seedSpecs(
  s: SpecInput
): ExtraFields & { partNumber: string | null } {
  const { n } = s
  const out: ExtraFields = {
    ...extraDefaults,
    features: [],
    compatibleMakeIds: [],
  }
  const origin = from(n, 1, [
    "japan",
    "japan",
    "gcc",
    "gcc",
    "usa",
    "europe",
    "korea",
    "china",
    "local",
  ] as const)
  if (s.kind === "part") {
    const brands = [
      "Bosch",
      "Denso",
      "TRW",
      "Gates",
      "Mahle",
      "Valeo",
      "NGK",
      "Toyota",
    ]
    const warrantyMonths = from(n, 40, [3, 6, 12])
    const warranty = from(n, 41, ["none", "none", "dealer"] as const)
    return {
      ...out,
      partNumber: share(n, 2, 0.7) ? `PN-${1000 + (hash(n, 3) % 9000)}` : null,
      partBrand: from(n, 4, brands),
      partType: from(n, 5, specOptions.partType),
      partPosition: share(n, 6, 0.5)
        ? from(n, 7, specOptions.partPosition)
        : null,
      quantity: 1 + (hash(n, 8) % 20),
      compatibleMakeIds: s.makeId && share(n, 9, 0.6) ? [s.makeId] : [],
      fitsYearFrom: 2005 + (hash(n, 10) % 10),
      fitsYearTo: 2016 + (hash(n, 11) % 10),
      origin,
      warranty,
      warrantyMonths: warranty === "none" ? null : warrantyMonths,
      dimensions: share(n, 12, 0.3) ? "30 x 20 x 10 cm" : null,
      weightKg: share(n, 13, 0.4) ? 1 + (hash(n, 14) % 15) : null,
      installation: maybe(n, 15, 0.5),
      delivery: maybe(n, 16, 0.6),
      returns: maybe(n, 17, 0.4),
    }
  }

  const type = s.type
  if (!type) return { ...out, partNumber: null }
  const car = type === "car"
  const heavy = type === "truck"
  const light = !car && !heavy
  const rent = s.intent === "rent"
  const registered = s.used ? share(n, 20, 0.85) : share(n, 21, 0.5)
  const warranty = s.used
    ? from(n, 22, ["none", "none", "none", "dealer"] as const)
    : from(n, 23, ["dealer", "manufacturer"] as const)
  const body = from(n, 24, bodyTypes[type])
  const seats = car
    ? from(n, 25, [5, 5, 5, 7])
    : heavy
      ? from(n, 25, [2, 3])
      : type === "motorcycle"
        ? 2
        : 3
  Object.assign(out, {
    trim: share(n, 26, 0.7)
      ? from(n, 27, ["Base", "LE", "XLE", "Sport", "Limited", "GL", "Premium"])
      : null,
    bodyType: body,
    colorInterior:
      !light && share(n, 28, 0.7)
        ? from(n, 29, ["black", "beige", "grey", "brown"])
        : null,
    origin,
    cylinders:
      light && type !== "motorcycle"
        ? null
        : car
          ? from(n, 30, [4, 4, 4, 6, 8])
          : heavy
            ? from(n, 30, [4, 6, 6, 8])
            : from(n, 30, [1, 1, 2, 4]),
    horsepower:
      s.engineCc && !(light && type !== "motorcycle")
        ? Math.max(5, Math.round(s.engineCc / 11))
        : null,
    driveType: car
      ? from(n, 31, ["fwd", "fwd", "fwd", "rwd", "awd", "four_wd"] as const)
      : heavy
        ? from(n, 31, ["rwd", "rwd", "four_wd"] as const)
        : null,
    strokes: type === "motorcycle" ? from(n, 32, [4, 4, 4, 2] as const) : null,
    starter:
      type === "motorcycle"
        ? from(n, 33, ["electric", "electric", "both", "kick"] as const)
        : null,
    doors: car
      ? body === "coupe" || body === "convertible"
        ? 2
        : body === "hatchback" || body === "suv"
          ? 5
          : 4
      : null,
    seats,
    axles: heavy ? from(n, 34, [2, 2, 3, 4]) : null,
    grossWeightTons: heavy ? from(n, 35, [7, 12, 18, 26]) : null,
    cabType: heavy ? from(n, 36, specOptions.cabType) : null,
    previousOwners: s.used ? hash(n, 37) % 4 : null,
    accidentFree: s.used
      ? share(n, 38, 0.7)
        ? true
        : share(n, 39, 0.5)
          ? false
          : null
      : null,
    paint:
      s.used && !light
        ? from(n, 42, ["original", "original", "partial", "full"] as const)
        : null,
    serviceHistory: s.used
      ? from(n, 43, ["full", "partial", "none", null] as const)
      : null,
    warranty,
    warrantyMonths: warranty === "none" ? null : from(n, 44, [6, 12, 24, 36]),
    customsCleared: share(n, 45, 0.85) ? true : null,
    registered,
    plateType: registered
      ? from(n, 46, [
          "private",
          "private",
          "private",
          "commercial",
          "taxi",
          "government",
        ] as const)
      : null,
    plateCityId: registered ? s.cityId : null,
    licenseValidUntil: registered
      ? `${2026 + (hash(n, 47) % 2)}-${String(1 + (hash(n, 48) % 12)).padStart(2, "0")}-15`
      : null,
    insurance: from(n, 49, [...specOptions.insurance, null] as const),
    chassisNumber: share(n, 50, 0.6)
      ? `SY${s.year ?? 2020}${String(n).padStart(6, "0")}`
      : null,
    exchange: !rent ? maybe(n, 51, 0.25) : null,
    financing: !rent ? maybe(n, 52, 0.2) : null,
    testDrive: maybe(n, 53, 0.6),
    inspectionReport: maybe(n, 54, 0.25),
  })
  if (rent) {
    Object.assign(out, {
      driver: car || heavy ? from(n, 60, specOptions.driver) : null,
      minRent: from(n, 61, [1, 1, 2, 3, 7]),
      deposit: from(n, 62, [0, 100_000, 200_000, 500_000]),
      kmLimitPerDay: from(n, 63, [100, 200, 300, null] as const),
      insuranceIncluded: maybe(n, 64, 0.7),
      fuelPolicy: from(n, 65, specOptions.fuelPolicy),
      delivery: maybe(n, 66, 0.5),
      minDriverAge: from(n, 67, [21, 23, 25]),
      licenseYears: from(n, 68, [1, 2, 3, 5]),
    })
  }
  // A newer, pricier vehicle has more of each group; the odds of a group are fixed so the seed stays the same on every run.
  const odds = {
    safety: 0.4,
    comfort: 0.55,
    tech: 0.3,
    exterior: 0.35,
    work: 0.4,
    bike: 0.4,
  }
  out.features = featureGroupsFor(type).flatMap((g, gi) =>
    featureGroups[g].filter((_, i) => share(n, 100 + gi * 40 + i, odds[g]))
  )
  return { ...out, partNumber: null }
}
