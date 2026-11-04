import { extraFields } from "@sayaratak/shared/schemas/listing-fields"
import { z } from "zod"

import * as listings from "~/modules/listings/listings.tables"
import { uploads } from "~/modules/uploads/uploads.tables"
import type { Executor } from "~/shared/db/tx"
import { searchText } from "~/shared/text/search-text"

import type { buildSeed } from "../../web/src/mocks/seed"

type Seed = ReturnType<typeof buildSeed>
type Listing = Seed["listings"][number]
type Upload = typeof uploads.$inferInsert

// Parsing keeps only the spec fields, typed, and drops the rest of the listing.
const details = z.object(extraFields)

/** Listings with their counters and media. A medium's id is its upload id; a video's poster is an upload of its own. */
export async function seedListings(ex: Executor, data: Seed) {
  if (!data.listings.length) return
  const names = new Map(
    [...data.taxonomy.makes, ...data.taxonomy.models].map((row) => [
      row.id,
      `${row.name.ar} ${row.name.en}`,
    ])
  )
  const files = data.listings.flatMap(mediaUploads)
  await ex.insert(uploads).values(files).onConflictDoNothing()
  await ex
    .insert(listings.listings)
    .values(data.listings.map((row) => listingRow(row, names)))
    .onConflictDoNothing()
  await ex
    .insert(listings.listingStats)
    .values(data.listings.map(({ id, stats }) => ({ listingId: id, ...stats })))
    .onConflictDoNothing()
  await ex
    .insert(listings.listingMedia)
    .values(
      data.listings.flatMap((row) =>
        row.media.map((m, position) => ({
          listingId: row.id,
          position,
          uploadId: m.id,
        }))
      )
    )
    .onConflictDoNothing()
}

function listingRow(
  row: Listing,
  names: Map<string, string>
): typeof listings.listings.$inferInsert {
  const name = (id: string | null) => (id ? names.get(id) : undefined)
  return {
    ...row,
    ownerType: row.owner.type,
    ownerName: row.owner.name,
    details: details.parse(row),
    lat: row.location?.lat,
    lng: row.location?.lng,
    searchText: searchText([
      row.title,
      row.description.ar,
      row.description.en,
      name(row.makeId),
      name(row.modelId),
    ]),
    bumpedAt: row.bumpedAt ? new Date(row.bumpedAt) : null,
    expiresAt: new Date(row.expiresAt),
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }
}

function mediaUploads(row: Listing): Upload[] {
  const base = {
    ownerUserId: row.ownerUserId,
    delivery: "public" as const,
    attachedAt: new Date(row.createdAt),
    createdAt: new Date(row.createdAt),
  }
  return row.media.flatMap((m) => {
    const poster = m.posterUrl ? `${m.id}-poster` : null
    const file: Upload = {
      ...base,
      id: m.id,
      kind: m.type,
      url: m.url,
      width: m.width,
      height: m.height,
      placeholderColor: m.placeholderColor,
      posterId: poster,
    }
    if (!poster || !m.posterUrl) return [file]
    const frame: Upload = {
      ...base,
      id: poster,
      kind: "image",
      url: m.posterUrl,
      width: m.width,
      height: m.height,
      placeholderColor: m.placeholderColor,
    }
    return [frame, file]
  })
}
