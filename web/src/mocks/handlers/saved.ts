import { okSchema } from "@sayaratak/shared/schemas/api"
import {
  favoriteInputSchema,
  favoriteSortSchema,
  savedSearchInputSchema,
  savedSearchPatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import {
  favoritePageSchema,
  typeFilterSchema,
} from "@sayaratak/shared/schemas/listing"
import { savedSearchSchema } from "@sayaratak/shared/schemas/saved-search"
import { z } from "zod"

import { db, find, insert, newId, paginate } from "../db"
import { fail, needUser, pageParams, route } from "../http"
import { nowIso } from "../lib"
import { isPublic } from "../search"
import type { ListingRow } from "../types"
import { shown } from "./listings"

type Saved = { listing: ListingRow; savedAt: string }
const bySaved = (a: Saved, b: Saved) => b.savedAt.localeCompare(a.savedAt)
const favoriteOrder: Record<
  z.infer<typeof favoriteSortSchema>,
  (a: Saved, b: Saved) => number
> = {
  recent: bySaved,
  price_asc: (a, b) => a.listing.price - b.listing.price || bySaved(a, b),
  price_desc: (a, b) => b.listing.price - a.listing.price || bySaved(a, b),
}

// `type` is a vehicle type or "part"; a bad `type` or `sort` falls back to no filter and `recent`. A listing nobody can open any more still comes back, flagged `unavailable`, so the person can remove it.
route("GET", "/favorites", (c) => {
  const user = needUser(c)
  const { page, pageSize } = pageParams(c.query, 24)
  const type = typeFilterSchema.safeParse(c.query.get("type")).data
  const sort = favoriteSortSchema.catch("recent").parse(c.query.get("sort"))
  const rows = db.favorites
    .filter((f) => f.userId === user.id)
    .flatMap((f) => {
      const listing = find(db.listings, f.listingId)
      return listing ? [{ listing, savedAt: f.createdAt }] : []
    })
    .filter(
      ({ listing: l }) =>
        !type || (type === "part" ? l.kind === "part" : l.vehicleType === type)
    )
    .sort(favoriteOrder[sort])
  const result = paginate(rows, page, pageSize)
  return favoritePageSchema.parse({
    ...result,
    items: result.items.map(({ listing, savedAt }) => ({
      ...shown(listing, user),
      savedAt,
      unavailable:
        !isPublic(listing) ||
        listing.status === "sold" ||
        listing.status === "rented",
    })),
  })
})
// Ids only, so every card can draw its heart without loading the full list. Public: empty when signed out.
route("GET", "/me/favorite-ids", (c) =>
  z.object({ ids: z.array(z.string()) }).parse({
    ids: db.favorites
      .filter((f) => f.userId === c.user?.id)
      .map((f) => f.listingId),
  })
)

route("POST", "/favorites", async (c) => {
  const user = needUser(c)
  const { listingId } = await c.body(favoriteInputSchema)
  const listing = find(db.listings, listingId)
  if (!listing) throw fail(404, "not_found")
  if (
    !db.favorites.some((f) => f.userId === user.id && f.listingId === listingId)
  ) {
    insert(db.favorites, {
      id: newId("f"),
      userId: user.id,
      listingId,
      createdAt: nowIso(),
    })
    listing.stats.favorites += 1
  }
  return okSchema.parse({ ok: true })
})
const unfavorite = (userId: string, listingId: string) => {
  const before = db.favorites.length
  db.favorites = db.favorites.filter(
    (f) => !(f.userId === userId && f.listingId === listingId)
  )
  const listing = find(db.listings, listingId)
  if (listing && db.favorites.length < before)
    listing.stats.favorites = Math.max(0, listing.stats.favorites - 1)
  return okSchema.parse({ ok: true })
}
route("DELETE", "/favorites/:listingId", (c) =>
  unfavorite(needUser(c).id, c.params.listingId ?? "")
)
route("DELETE", "/favorites", (c) =>
  unfavorite(needUser(c).id, c.query.get("listingId") ?? "")
)

const savedOf = (userId: string, id: string) => {
  const row = find(db.savedSearches, id)
  if (!row || row.userId !== userId) throw fail(404, "not_found")
  return row
}
route("GET", "/saved-searches", (c) =>
  z
    .array(savedSearchSchema)
    .parse(db.savedSearches.filter((s) => s.userId === needUser(c).id))
)
route("POST", "/saved-searches", async (c) => {
  const user = needUser(c)
  const input = await c.body(savedSearchInputSchema)
  const row = {
    id: newId("ss"),
    userId: user.id,
    name: input.name,
    params: input.params,
    alerts: input.alerts,
    newCount: 0,
    createdAt: nowIso(),
  }
  insert(db.savedSearches, row)
  return savedSearchSchema.parse(row)
})
route("PATCH", "/saved-searches/:id", async (c) => {
  const row = savedOf(needUser(c).id, c.params.id ?? "")
  const { markSeen, ...patch } = await c.body(savedSearchPatchSchema)
  Object.assign(row, patch)
  if (markSeen) row.newCount = 0
  return savedSearchSchema.parse(row)
})
route("DELETE", "/saved-searches/:id", (c) => {
  const row = savedOf(needUser(c).id, c.params.id ?? "")
  db.savedSearches = db.savedSearches.filter((s) => s.id !== row.id)
  return okSchema.parse({ ok: true })
})
