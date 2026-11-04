import { z } from "zod"

import {
  fuelSchema,
  intentSchema,
  transmissionSchema,
  vehicleTypeSchema,
} from "../schemas/listing"

// Bad URL values are dropped, never crash the page.
export const optional = <T extends z.ZodTypeAny>(s: T) =>
  s.optional().catch(undefined)

export const searchParamsSchema = z.object({
  kind: z.enum(["vehicle", "part"]).default("vehicle").catch("vehicle"),
  intent: optional(intentSchema),
  type: optional(vehicleTypeSchema),
  q: optional(z.string().trim().max(80)),
  city: optional(z.string()),
  district: optional(z.string()),
  make: optional(z.string()),
  model: optional(z.string()),
  minPrice: optional(z.coerce.number().int().min(0)),
  maxPrice: optional(z.coerce.number().int().min(0)),
  minYear: optional(z.coerce.number().int().min(1970)),
  maxYear: optional(z.coerce.number().int()),
  maxMileage: optional(z.coerce.number().int().min(0)),
  fuel: optional(z.array(fuelSchema)),
  transmission: optional(z.array(transmissionSchema)),
  condition: optional(z.enum(["new", "used"])),
  partCategory: optional(z.string()),
  radius: optional(
    z.coerce.number().refine((v) => [5, 10, 25, 50, 100].includes(v))
  ),
  lat: optional(z.coerce.number()),
  lng: optional(z.coerce.number()),
  // Filters on the step 7.9 fields. A flag is present or absent, never false. Lists match any chosen value, except `features`, which needs every one.
  body: optional(z.array(z.string())),
  drive: optional(z.array(z.string())),
  madeIn: optional(z.array(z.string())),
  driver: optional(z.array(z.string())),
  partType: optional(z.array(z.string())),
  features: optional(z.array(z.string())),
  seatsMin: optional(z.coerce.number().int().min(1)),
  fitsYear: optional(z.coerce.number().int().min(1970)),
  customs: optional(z.boolean()),
  accidentFree: optional(z.boolean()),
  registered: optional(z.boolean()),
  firstOwner: optional(z.boolean()),
  fullService: optional(z.boolean()),
  warranty: optional(z.boolean()),
  exchange: optional(z.boolean()),
  financing: optional(z.boolean()),
  insuranceIncluded: optional(z.boolean()),
  delivery: optional(z.boolean()),
  installation: optional(z.boolean()),
  verifiedOnly: optional(z.boolean()),
  hasVideo: optional(z.boolean()),
  featured: optional(z.boolean()), // an active homepage or sponsored promotion; used by the home Featured rail
  includeSold: z.boolean().default(false).catch(false),
  seller: optional(z.string()), // owner id, used by profile inventory tabs
  sort: z
    .enum([
      "relevance",
      "newest",
      "price_asc",
      "price_desc",
      "year_desc",
      "mileage_asc",
      "nearest",
    ])
    .default("relevance")
    .catch("relevance"),
  page: z.coerce.number().int().min(1).default(1).catch(1),
})
export type SearchParams = z.infer<typeof searchParamsSchema>

// The yes-only filters, in the order the form lists them.
export const flagKeys = [
  "customs",
  "accidentFree",
  "registered",
  "firstOwner",
  "fullService",
  "warranty",
  "exchange",
  "financing",
  "insuranceIncluded",
  "delivery",
  "installation",
] as const satisfies readonly (keyof SearchParams)[]
export type FlagKey = (typeof flagKeys)[number]
// Label key of each flag: chip, checkbox and nothing else.
export const flagLabel: Record<FlagKey, string> = {
  customs: "search.flag_customs",
  accidentFree: "search.flag_accident_free",
  registered: "search.flag_registered",
  firstOwner: "search.flag_first_owner",
  fullService: "search.flag_full_service",
  warranty: "search.flag_warranty",
  exchange: "search.flag_exchange",
  financing: "search.flag_financing",
  insuranceIncluded: "search.flag_insurance_included",
  delivery: "search.flag_delivery",
  installation: "search.flag_installation",
}
// The multi-choice filters and the label prefix of their values (`spec.<prefix>_<value>`).
export const listKeys = [
  "body",
  "drive",
  "madeIn",
  "driver",
  "partType",
] as const
export type ListKey = (typeof listKeys)[number]
// The params that repeat in a query string, one key per value.
export const arrayKeys = ["fuel", "transmission", ...listKeys, "features"]
export const listPrefix: Record<ListKey, string> = {
  body: "body",
  drive: "drive",
  madeIn: "origin",
  driver: "driver",
  partType: "part_type",
}

const defaults = searchParamsSchema.parse({})

// Params without the defaults the schema fills in, so URLs stay short and a default never counts as a filter.
export function compact(p: SearchParams): Partial<SearchParams> {
  const out: Partial<SearchParams> = { ...p }
  for (const k of ["kind", "sort", "includeSold", "page"] as const)
    if (out[k] === defaults[k]) delete out[k]
  return out
}

// What the routes validate with. The router writes a route's validated search back into the URL, so a schema that fills in defaults would redirect `/search` to `/search?kind=vehicle&sort=relevance&...`. These leave defaults out; a page reads the full set with `fullSearch`. A default is an explicit undefined, not a missing key: the router merges the validated search over the raw one, and only an explicit undefined removes `?sort=bogus` from the address.
const withoutDefaults = (p: SearchParams): Partial<SearchParams> => ({
  kind: undefined,
  sort: undefined,
  includeSold: undefined,
  page: undefined,
  ...compact(p),
})
export const routeSearchSchema = searchParamsSchema.transform(withoutDefaults)
// /parts: the path holds the kind, so a `kind` in the URL is ignored.
export const partsRouteSchema = searchParamsSchema.transform((s) =>
  withoutDefaults({ ...s, kind: "vehicle" })
)

export const fullSearch = (
  sparse: Partial<SearchParams>,
  kind: SearchParams["kind"] = "vehicle"
) => searchParamsSchema.parse({ ...sparse, kind: sparse.kind ?? kind })
