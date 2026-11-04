import type { listingPatchSchema } from "@sayaratak/shared/schemas/inputs"
import { extraFields } from "@sayaratak/shared/schemas/listing-fields"
import { z } from "zod"

import type { Executor } from "~/shared/db/tx"
import { searchText } from "~/shared/text/search-text"
import * as taxonomy from "~/modules/taxonomy/taxonomy.service"

import type { ListingRow } from "./listings.view.service"

type ListingBody = z.output<typeof listingPatchSchema>

// The input keys stored as they come, each in its own column.
const PLAIN_KEYS = [
  "kind",
  "intent",
  "vehicleType",
  "title",
  "price",
  "negotiable",
  "rentPeriod",
  "condition",
  "makeId",
  "modelId",
  "makeOther",
  "modelOther",
  "year",
  "mileageKm",
  "fuel",
  "transmission",
  "color",
  "engineCc",
  "payloadTons",
  "partNumber",
  "partCategoryId",
  "compatibleTypes",
  "cityId",
  "districtId",
] as const
// Parsing keeps only the spec fields the body sent (mock `extrasOf`).
const extrasInput = z.object(extraFields).partial()

type PlainColumns = Partial<Pick<ListingRow, (typeof PLAIN_KEYS)[number]>>

/**
 * The columns a create or patch body sets, only for the keys it sent. The
 * spec fields merge into `details`; a pin becomes `lat` and `lng`.
 */
export function columnsOf(body: ListingBody, details: ListingRow["details"]) {
  const plain: PlainColumns = {}
  for (const key of PLAIN_KEYS) {
    if (body[key] !== undefined) Object.assign(plain, { [key]: body[key] })
  }
  const pin =
    body.location === undefined
      ? {}
      : { lat: body.location?.lat ?? null, lng: body.location?.lng ?? null }
  return {
    ...plain,
    ...pin,
    details: { ...details, ...extrasInput.parse(body) },
  }
}

/** What `q` matches: the title, both description slots and the make and model names (A11). */
export async function searchTextOf(
  ex: Executor,
  listing: Pick<ListingRow, "title" | "description"> &
    Partial<Pick<ListingRow, "makeId" | "modelId">>
) {
  const makeId = listing.makeId ?? null
  const modelId = listing.modelId ?? null
  const names = await taxonomy.getNames(ex, [makeId, modelId])
  const name = (id: string | null) => (id ? names.get(id) : undefined)
  return searchText([
    listing.title,
    listing.description.ar,
    listing.description.en,
    name(makeId),
    name(modelId),
  ])
}
