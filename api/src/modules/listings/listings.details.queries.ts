import type { SearchParams } from "@sayaratak/shared/search/schemas"
import { inArray, type SQL, sql } from "drizzle-orm"

import { listings } from "./listings.tables"

// Yes-only flags that test one `details` value for equality (mock `flagTests`).
const DETAIL_FLAGS = [
  ["customs", { customsCleared: true }],
  ["accidentFree", { accidentFree: true }],
  ["registered", { registered: true }],
  ["firstOwner", { previousOwners: 0 }],
  ["fullService", { serviceHistory: "full" }],
  ["exchange", { exchange: true }],
  ["financing", { financing: true }],
  ["insuranceIncluded", { insuranceIncluded: true }],
  ["delivery", { delivery: true }],
  ["installation", { installation: true }],
] as const satisfies readonly (readonly [keyof SearchParams, object])[]
// List filters: the listing's `details` value must be one of the chosen.
const DETAIL_LISTS = [
  ["body", "bodyType"],
  ["drive", "driveType"],
  ["madeIn", "origin"],
  ["driver", "driver"],
  ["partType", "partType"],
] as const satisfies readonly (readonly [keyof SearchParams, string])[]

// `details @> {...}` uses the jsonb_path_ops GIN index (A11). The value goes
// in as text and is cast: Bun SQL would send a JS string as a JSON string.
export function detailsWhere(p: SearchParams): (SQL | undefined)[] {
  const out: (SQL | undefined)[] = []
  for (const [flag, value] of DETAIL_FLAGS) {
    if (p[flag])
      out.push(
        sql`${listings.details} @> ${JSON.stringify(value)}::text::jsonb`
      )
  }
  // Warranty: any value except none (and not empty).
  if (p.warranty)
    out.push(
      sql`coalesce(${listings.details} ->> 'warranty', 'none') not in ('none', '')`
    )
  for (const [param, field] of DETAIL_LISTS) {
    const chosen = p[param]
    if (chosen?.length)
      out.push(inArray(sql`${listings.details} ->> ${field}`, chosen))
  }
  if (p.features?.length)
    out.push(
      sql`${listings.details} @> ${JSON.stringify({ features: p.features })}::text::jsonb`
    )
  if (p.seatsMin !== undefined)
    out.push(
      sql`coalesce((${listings.details} ->> 'seats')::int, 0) >= ${p.seatsMin}`
    )
  if (p.fitsYear !== undefined)
    out.push(
      sql`coalesce((${listings.details} ->> 'fitsYearFrom')::int, 0) <= ${p.fitsYear} and coalesce((${listings.details} ->> 'fitsYearTo')::int, 9999) >= ${p.fitsYear}`
    )
  return out
}
