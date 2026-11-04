import type { z } from "zod"

import {
  contactStepSchema,
  detailsSchema,
  listingInputSchema,
  photosStepSchema,
  typeStepSchema,
} from "@sayaratak/shared/listings/schemas"
import { arrayKeys, searchParamsSchema } from "@sayaratak/shared/search/schemas"
import { listingAnalyticsSchema } from "@sayaratak/shared/schemas/api"
import {
  listingCreateSchema,
  listingPatchSchema,
  listingStatusInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import {
  listingPageSchema,
  listingSchema,
} from "@sayaratak/shared/schemas/listing"
import { taxonomySchema } from "@sayaratak/shared/schemas/taxonomy"
import { makeListingSlug, parseListingId } from "@sayaratak/shared/lib/slug"
import { bilingualName, both } from "@/mocks/seed/util"

import { db, find, insert, newListingId, paginate, remove } from "../db"
import {
  fail,
  needRole,
  needUser,
  pageParams,
  queryObject,
  route,
  zodFields,
} from "../http"
import {
  DAY_MS,
  canEditListing,
  eventSeries,
  listingById,
  listingLimit,
  listingUsage,
  nowIso,
  rangeDays,
  extrasOf,
} from "../lib"
import { facets, isPublic, matches, sortListings } from "../search"
import type { ListingRow, UserRow } from "../types"

const owned = (l: ListingRow) => listingSchema.parse(l)

// Everyone except the owner and admins sees the position rounded to 2 decimals (about 1 km), so a private seller's exact spot stays private.
const round2 = (n: number) => Math.round(n * 100) / 100
const forViewer = (l: ListingRow, viewer?: UserRow | null) =>
  l.location && viewer?.id !== l.ownerUserId && viewer?.role !== "admin"
    ? {
        ...l,
        location: { lat: round2(l.location.lat), lng: round2(l.location.lng) },
      }
    : l
export const shown = (l: ListingRow, viewer?: UserRow | null) =>
  owned(forViewer(l, viewer))

// Cities of a turned-off country, and their districts, stay off the public site.
route("GET", "/taxonomy", () => {
  const on = new Set(db.countries.filter((c) => c.enabled).map((c) => c.id))
  const cities = db.taxonomy.cities.filter((c) => on.has(c.countryId))
  const kept = new Set(cities.map((c) => c.id))
  return taxonomySchema.parse({
    ...db.taxonomy,
    cities,
    districts: db.taxonomy.districts.filter((d) => kept.has(d.cityId)),
  })
})

// `limit` (1 to 24) and `exclude` serve the rails; they are not search params of a page.
route("GET", "/listings", (c) => {
  const params = searchParamsSchema.parse(queryObject(c.query, arrayKeys))
  const exclude = c.query.get("exclude")
  const rows = sortListings(
    db.listings.filter((l) => l.id !== exclude && matches(l, params)),
    params
  )
  const { pageSize } = pageParams(c.query, 24)
  const result = paginate(rows, params.page, pageSize)
  return listingPageSchema.parse({
    ...result,
    items: result.items.map((l) => shown(l, c.user)),
    facets: facets(params),
  })
})

// Draft, pending, rejected and removed listings, and those of a banned owner or suspended business, are visible to their owner and to admins only.
route("GET", "/listings/:slug", (c) => {
  const row = find(db.listings, parseListingId(c.params.slug ?? ""))
  if (
    !row ||
    (!isPublic(row) &&
      c.user?.id !== row.ownerUserId &&
      c.user?.role !== "admin")
  )
    throw fail(404, "not_found")
  return shown(row, c.user)
})

route("GET", "/listings/:id/similar", (c) => {
  const row = listingById(c.params.id ?? "")
  const similar = db.listings
    .filter(
      (l) =>
        l.id !== row.id &&
        isPublic(l) &&
        l.status === "available" &&
        l.kind === row.kind &&
        l.intent === row.intent &&
        l.vehicleType === row.vehicleType
    )
    .sort(
      (a, b) => Math.abs(a.price - row.price) - Math.abs(b.price - row.price)
    )
    .slice(0, 8)
  return similar.map((l) => shown(l, c.user))
})

// Verified dealers skip review when the admin setting is on.
const publishState = (
  user: UserRow,
  submit: boolean
): ListingRow["moderation"] => {
  if (!submit) return "draft"
  const dealer = db.dealerships.find((d) => d.ownerId === user.id)
  return db.settings.autoApproveVerifiedDealers && dealer?.verified
    ? "approved"
    : "pending"
}

const reviewedFields = (l: ListingRow) =>
  JSON.stringify([
    l.title,
    l.description,
    l.media,
    l.kind,
    l.vehicleType,
    l.partCategoryId,
  ])

// A listing sent for review has to pass what the wizard checked: the flat payload, then the rules of each step. A draft may be incomplete.
function checkSubmitted(body: z.input<typeof listingPatchSchema>) {
  const flat = listingInputSchema.safeParse({ ...body, ...body.contact })
  if (!flat.success) throw fail(422, "validation", zodFields(flat.error))
  // The details step holds an empty part number as "", the payload as null.
  const values = { ...flat.data, partNumber: flat.data.partNumber ?? "" }
  const rules = [
    typeStepSchema,
    detailsSchema(values),
    photosStepSchema,
    contactStepSchema,
  ]
  const fields = rules.map((rule) => {
    const result = rule.safeParse(values)
    return result.success ? {} : zodFields(result.error)
  })
  if (fields.some((f) => Object.keys(f).length > 0))
    throw fail(422, "validation", Object.assign({}, ...fields))
}

route("POST", "/listings", async (c) => {
  const user = needRole(c, "user", "dealership")
  const input = await c.body(listingCreateSchema)
  const limit = listingLimit(user.id)
  if (input.submit && limit !== null && listingUsage(user.id) >= limit)
    throw fail(403, "limit_reached")
  if (input.submit) checkSubmitted(input)
  const city = db.taxonomy.cities.find((x) => x.id === input.cityId)
  if (!city) throw fail(422, "validation", { cityId: "validation.required" })
  const dealer = db.dealerships.find((d) => d.ownerId === user.id)
  const id = newListingId()
  const phone = input.contact?.phone ?? user.phone ?? dealer?.phones[0] ?? ""
  const now = nowIso()
  const row: ListingRow = {
    id,
    slug: makeListingSlug(input.title, city.id, id),
    kind: input.kind ?? "vehicle",
    intent: input.intent ?? "sale",
    vehicleType: input.vehicleType ?? null,
    title: input.title,
    description: both(input.description ?? ""),
    price: input.price,
    negotiable: input.negotiable ?? false,
    rentPeriod: input.rentPeriod ?? null,
    condition: input.condition ?? "used",
    makeId: input.makeId ?? null,
    modelId: input.modelId ?? null,
    makeOther: input.makeOther ?? null,
    modelOther: input.modelOther ?? null,
    year: input.year ?? null,
    mileageKm: input.mileageKm ?? null,
    fuel: input.fuel ?? null,
    transmission: input.transmission ?? null,
    color: input.color ?? null,
    engineCc: input.engineCc ?? null,
    payloadTons: input.payloadTons ?? null,
    partNumber: input.partNumber ?? null,
    ...extrasOf(input),
    partCategoryId: input.partCategoryId ?? null,
    compatibleTypes: input.compatibleTypes ?? [],
    media: input.media ?? [],
    cityId: city.id,
    districtId: input.districtId ?? null,
    location: input.location ?? null,
    status: "available",
    moderation: publishState(user, input.submit ?? false),
    rejectionReason: null,
    promotions: [],
    owner: dealer
      ? {
          id: dealer.ownerId,
          type: "dealership",
          name: dealer.name,
          avatarUrl: dealer.logoUrl,
          verified: dealer.verified,
          memberSince: dealer.createdAt,
          profileSlug: dealer.slug,
        }
      : {
          id: user.id,
          type: "user",
          name: bilingualName(user.fullName),
          avatarUrl: user.avatarUrl ?? null,
          verified: user.verifiedPhone,
          memberSince: user.createdAt,
          profileSlug: null,
        },
    ownerUserId: user.id,
    contact: {
      phone,
      whatsapp: input.contact?.whatsapp ?? null,
      showPhone: input.contact?.showPhone ?? true,
      methods: input.contact?.methods ?? ["call", "chat"],
    },
    stats: { views: 0, favorites: 0, phoneClicks: 0, whatsappClicks: 0 },
    createdAt: now,
    updatedAt: now,
    expiresAt: new Date(
      Date.now() + db.settings.listingExpiryDays * DAY_MS
    ).toISOString(),
  }
  insert(db.listings, row)
  return owned(row)
})

route("PATCH", "/listings/:id", async (c) => {
  const user = needUser(c)
  const row = listingById(c.params.id ?? "")
  canEditListing(user, row)
  const { submit, moderation, ...patch } = await c.body(listingPatchSchema)
  if (moderation && user.role !== "admin") throw fail(403, "forbidden")
  // The wizard sends the whole listing (it always has `kind`); a partial patch such as a status change is not re-checked.
  if (submit && patch.kind !== undefined) checkSubmitted({ ...patch, submit })
  const reviewed = reviewedFields(row)
  if (patch.contact) row.contact = { ...row.contact, ...patch.contact }
  const { contact: _contact, description, ...fields } = patch
  Object.assign(row, fields)
  if (description !== undefined) row.description = both(description)
  if (patch.title || patch.cityId)
    row.slug = makeListingSlug(row.title, row.cityId, row.id)
  if (moderation) row.moderation = moderation
  // Changing what a buyer judges the listing by sends an approved one back to review, unless the owner is auto-approved. Price and status never do.
  else if (
    row.moderation === "approved" &&
    user.role !== "admin" &&
    reviewedFields(row) !== reviewed
  )
    row.moderation = publishState(user, true)
  if (submit && (row.moderation === "draft" || row.moderation === "rejected")) {
    const limit = listingLimit(row.ownerUserId)
    if (limit !== null && listingUsage(row.ownerUserId) >= limit)
      throw fail(403, "limit_reached")
    row.moderation = publishState(user, true)
    row.rejectionReason = null
  }
  row.updatedAt = nowIso()
  return owned(row)
})

route("DELETE", "/listings/:id", (c) => {
  const user = needUser(c)
  const row = listingById(c.params.id ?? "")
  canEditListing(user, row)
  remove(db.listings, row.id)
  db.favorites = db.favorites.filter((f) => f.listingId !== row.id)
  return undefined
})

route("POST", "/listings/:id/status", async (c) => {
  const user = needUser(c)
  const row = listingById(c.params.id ?? "")
  canEditListing(user, row)
  row.status = (await c.body(listingStatusInputSchema)).status
  row.updatedAt = nowIso()
  return owned(row)
})

route("POST", "/listings/:id/renew", (c) => {
  const user = needUser(c)
  const row = listingById(c.params.id ?? "")
  canEditListing(user, row)
  // The later of now and the current end, plus the setting, so renewing early loses no days.
  row.expiresAt = new Date(
    Math.max(Date.now(), Date.parse(row.expiresAt)) +
      db.settings.listingExpiryDays * DAY_MS
  ).toISOString()
  row.updatedAt = nowIso()
  return owned(row)
})

route("POST", "/listings/:id/duplicate", (c) => {
  const user = needUser(c)
  const row = listingById(c.params.id ?? "")
  canEditListing(user, row)
  const id = newListingId()
  const now = nowIso()
  const copy: ListingRow = {
    ...structuredClone(row),
    id,
    slug: makeListingSlug(row.title, row.cityId, id),
    moderation: "draft",
    status: "available",
    rejectionReason: null,
    promotions: [],
    stats: { views: 0, favorites: 0, phoneClicks: 0, whatsappClicks: 0 },
    createdAt: now,
    updatedAt: now,
  }
  insert(db.listings, copy)
  return owned(copy)
})

// Sort keys of the owner's table (8.2); anything else is newest first.
const mineKey: Record<string, (l: ListingRow) => number | string> = {
  price: (l) => l.price,
  views: (l) => l.stats.views,
  expires: (l) => l.expiresAt,
}
const sortMine =
  (key: string | null, dir: 1 | -1) => (a: ListingRow, b: ListingRow) => {
    const by = mineKey[key ?? ""] ?? ((l: ListingRow) => l.createdAt)
    const [x, y] = [by(a), by(b)]
    return (x < y ? -1 : x > y ? 1 : 0) * dir
  }

route("GET", "/me/listings", (c) => {
  const user = needRole(c, "user", "dealership")
  const q = c.query.get("q")?.toLowerCase()
  const type = c.query.get("type")
  const intent = c.query.get("intent")
  const moderation = c.query.get("moderation")
  const status = c.query.get("status")
  const attention = c.query.get("needsAttention") === "true"
  const tab = c.query.get("tab") ?? "all"
  const now = Date.now()
  // Tab rules (8.2): active is approved, available or reserved and not expired; pending, rejected and drafts follow `moderation`.
  const expired = (l: ListingRow) => Date.parse(l.expiresAt) <= now
  const inTab: Record<string, (l: ListingRow) => boolean> = {
    active: (l) =>
      l.moderation === "approved" &&
      (l.status === "available" || l.status === "reserved") &&
      !expired(l),
    pending: (l) => l.moderation === "pending",
    rejected: (l) => l.moderation === "rejected",
    drafts: (l) => l.moderation === "draft",
    closed: (l) => l.status === "sold" || l.status === "rented",
    expired: (l) => l.moderation === "approved" && expired(l),
  }
  const rows = db.listings
    .filter((l) => l.ownerUserId === user.id)
    .filter((l) => inTab[tab]?.(l) ?? l.moderation !== "removed")
    .filter(
      (l) =>
        !q ||
        l.title.toLowerCase().includes(q) ||
        l.id.toLowerCase().includes(q)
    )
    .filter(
      (l) =>
        !type || (type === "part" ? l.kind === "part" : l.vehicleType === type)
    )
    .filter((l) => !intent || l.intent === intent)
    .filter((l) => !moderation || l.moderation === moderation)
    .filter((l) => !status || l.status === status)
    .filter(
      (l) =>
        !attention ||
        l.moderation === "rejected" ||
        (l.moderation === "approved" &&
          (Date.parse(l.expiresAt) - now < 7 * DAY_MS ||
            (l.status === "reserved" &&
              now - Date.parse(l.updatedAt) >= 14 * DAY_MS)))
    )
    .sort(sortMine(c.query.get("sort"), c.query.get("dir") === "asc" ? 1 : -1))
  // `pageSize` goes up to 500 here, for the CSV export.
  const { page: p, pageSize } = pageParams(c.query, 20, 500)
  const result = paginate(rows, p, pageSize)
  return { ...result, items: result.items.map(owned) }
})

route("GET", "/listings/:id/analytics", (c) => {
  const user = needUser(c)
  const row = listingById(c.params.id ?? "")
  canEditListing(user, row)
  const days = rangeDays(c.query)
  const series = eventSeries((id) => id === row.id, days)
  const sum = (key: "views" | "phoneClicks" | "whatsappClicks" | "shares") =>
    series.reduce((s, d) => s + d[key], 0)
  return listingAnalyticsSchema.parse({
    range: `${days}d`,
    totals: {
      views: sum("views"),
      phoneClicks: sum("phoneClicks"),
      whatsappClicks: sum("whatsappClicks"),
      shares: sum("shares"),
      favorites: row.stats.favorites,
    },
    series,
    top: [],
  })
})
