import {
  backupSchema,
  bannerSchema,
  adminReportSchema,
  adminReviewSchema,
  settingsSchema,
  type Report,
  sitePageSchema,
} from "@sayaratak/shared/schemas/admin"
import { okSchema, taxonomyTypeSchema } from "@sayaratak/shared/schemas/api"
import { pageOf, type Bilingual } from "@sayaratak/shared/schemas/fields"
import {
  bannerInputSchema,
  noteInputSchema,
  pagePatchSchema,
  reportActionInputSchema,
  settingsPatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import { reviewSchema } from "@sayaratak/shared/schemas/review"
import {
  taxonomyCreateSchemas,
  taxonomyPatchSchemas,
} from "@sayaratak/shared/schemas/taxonomy-inputs"
import { z } from "zod"

import { slugify } from "@sayaratak/shared/lib/slug"
import { db, find, insert, newId, remove, restoreDb, takeSnapshot } from "../db"
import { fail, needRole, route, type Ctx } from "../http"
import {
  byNewest,
  findBusiness,
  listPage,
  nowIso,
  notify,
  syncFreeLimit,
} from "../lib"
import { setBan } from "./admin"
import { recomputeRating } from "./reviews"

const admin = (c: Ctx) => needRole(c, "admin")
const businesses = () => [...db.dealerships, ...db.workshops, ...db.mechanics]
const ack = () => okSchema.parse({ ok: true })

// Filters: `status`, `targetType`, `rating` (exact stars) and `id` (one review, for a link). `q` matches the author, the text and the business name.
route("GET", "/admin/reviews", (c) => {
  admin(c)
  const q = (key: string) => c.query.get(key)
  const rows = db.reviews
    .filter(
      (r) =>
        (!q("id") || r.id === q("id")) &&
        (!q("status") || r.status === q("status")) &&
        (!q("targetType") || r.targetType === q("targetType")) &&
        (!q("rating") || r.rating === Number(q("rating")))
    )
    .sort(byNewest)
    .map((r) => {
      const target = findBusiness(r.targetId)
      return {
        ...r,
        target: target ? { name: target.name, slug: target.slug } : null,
      }
    })
  return pageOf(adminReviewSchema).parse(
    listPage(
      c,
      rows,
      (r) =>
        `${r.authorName} ${r.body ?? ""} ${r.target?.name.ar ?? ""} ${r.target?.name.en ?? ""}`
    )
  )
})
for (const [action, status] of [
  ["hide", "hidden"],
  ["show", "visible"],
] as const) {
  route("POST", `/admin/reviews/:id/${action}`, (c) => {
    admin(c)
    const row = find(db.reviews, c.params.id ?? "")
    if (!row) throw fail(404, "not_found")
    row.status = status
    recomputeRating(row.targetId)
    return reviewSchema.parse(row)
  })
}

// `status` is open or resolved (dismissed and actioned); `id` returns that one report, for a sheet opened from a link.
const reportRow = (r: Report) => {
  const listing = find(db.listings, r.listingId)
  const seller = listing && find(db.users, listing.ownerUserId)
  return {
    ...r,
    listing: listing ?? null,
    reporterName: find(db.users, r.reporterId)?.fullName ?? "",
    listingReports: db.reports.filter((o) => o.listingId === r.listingId)
      .length,
    sellerBanned: !!seller?.banned,
  }
}
route("GET", "/admin/reports", (c) => {
  admin(c)
  const status = c.query.get("status")
  const id = c.query.get("id")
  const rows = db.reports
    .filter((r) => !id || r.id === id)
    .filter(
      (r) =>
        !status ||
        (status === "resolved" ? r.status !== "open" : r.status === status)
    )
    .sort(byNewest)
    .map(reportRow)
  return pageOf(adminReportSchema).parse(
    listPage(c, rows, (r) => `${r.listing?.title ?? ""} ${r.reporterName}`)
  )
})
route("POST", "/admin/reports/:id/dismiss", async (c) => {
  admin(c)
  const row = find(db.reports, c.params.id ?? "")
  if (!row) throw fail(404, "not_found")
  row.status = "dismissed"
  row.resolutionNote = (await c.body(noteInputSchema)).note
  return adminReportSchema.parse(reportRow(row))
})
// Removes the listing and tells its owner, or (with `ban`) bans the owner and tells nobody. Every open report on the listing closes with the same note.
route("POST", "/admin/reports/:id/action", async (c) => {
  admin(c)
  const row = find(db.reports, c.params.id ?? "")
  if (!row) throw fail(404, "not_found")
  const { note, ban } = await c.body(reportActionInputSchema)
  const listing = find(db.listings, row.listingId)
  if (ban) {
    const seller = listing && find(db.users, listing.ownerUserId)
    if (!seller) throw fail(404, "not_found")
    if (seller.role === "admin") throw fail(403, "forbidden")
    setBan(seller, ban)
  } else if (listing) {
    listing.moderation = "removed"
    notify(
      listing.ownerUserId,
      "listing_rejected",
      { ar: "تمت إزالة إعلانك", en: "Your listing was removed" },
      { ar: listing.title, en: listing.title }
    )
  }
  for (const r of db.reports)
    if (r.listingId === row.listingId && (r === row || r.status === "open")) {
      r.status = "actioned"
      r.resolutionNote = note
    }
  return adminReportSchema.parse(reportRow(row))
})

// Taxonomy: one generic CRUD over the seven admin-managed lists. The input shapes are shared with the api.
type Loose = { id: string; [key: string]: unknown }
type TaxonomyType = z.infer<typeof taxonomyTypeSchema>
const taxonomy: Record<
  TaxonomyType,
  { rows: () => Loose[]; useOf: (id: string) => boolean }
> = {
  // A city's slug is made once, on create, from its English name; landing URLs use it, so it never changes.
  cities: {
    rows: () => db.taxonomy.cities,
    useOf: (id) =>
      db.taxonomy.districts.some((d) => d.cityId === id) ||
      db.listings.some((l) => l.cityId === id) ||
      businesses().some((b) => b.cityId === id) ||
      db.users.some((u) => u.cityId === id),
  },
  districts: {
    rows: () => db.taxonomy.districts,
    useOf: (id) =>
      db.listings.some((l) => l.districtId === id) ||
      businesses().some((b) => "districtId" in b && b.districtId === id),
  },
  makes: {
    rows: () => db.taxonomy.makes,
    useOf: (id) =>
      db.listings.some((l) => l.makeId === id) ||
      db.taxonomy.models.some((m) => m.makeId === id),
  },
  models: {
    rows: () => db.taxonomy.models,
    useOf: (id) => db.listings.some((l) => l.modelId === id),
  },
  "vehicle-types": { rows: () => db.taxonomy.vehicleTypes, useOf: () => true },
  "part-categories": {
    rows: () => db.taxonomy.partCategories,
    useOf: (id) => db.listings.some((l) => l.partCategoryId === id),
  },
  countries: {
    rows: () => db.countries,
    useOf: (id) => db.taxonomy.cities.some((c) => c.countryId === id),
  },
}
// These lists give a new row its id and slug from the English name; a countries row takes its id from `code`.
const slugged = new Set(["part-categories", "cities", "makes"])
const kind = (c: Ctx) => {
  admin(c)
  const type = taxonomyTypeSchema.safeParse(c.params.type)
  if (!type.success) throw fail(404, "not_found")
  return { type: type.data, ...taxonomy[type.data] }
}
route("GET", "/admin/taxonomy/:type", (c) => kind(c).rows())
route("POST", "/admin/taxonomy/:type", async (c) => {
  const { type, rows } = kind(c)
  if (type === "vehicle-types") throw fail(403, "forbidden")
  const { code, ...fields }: Record<string, unknown> = await c.body(
    taxonomyCreateSchemas[type]
  )
  // The slug (and id) of a part category, city or make comes from its English name, with a number added when taken.
  if (slugged.has(type)) {
    const base = slugify((fields.name as Bilingual).en) || type.slice(0, -1)
    let slug = base
    for (let n = 2; rows().some((r) => r.id === slug); n++)
      slug = `${base}-${n}`
    fields.slug = slug
  }
  const id =
    typeof code === "string"
      ? code
      : typeof fields.slug === "string"
        ? fields.slug
        : newId(type.slice(0, 3))
  if (rows().some((r) => r.id === id)) throw fail(409, "exists")
  return insert(rows(), { ...fields, id })
})
route("DELETE", "/admin/taxonomy/:type/:id", (c) => {
  const { type, rows, useOf } = kind(c)
  if (type === "vehicle-types") throw fail(403, "forbidden")
  if (useOf(c.params.id ?? "")) throw fail(409, "in_use")
  if (!remove(rows(), c.params.id ?? "")) throw fail(404, "not_found")
  return ack()
})
route("PATCH", "/admin/taxonomy/:type/:id", async (c) => {
  const { type, rows } = kind(c)
  const row = find(rows(), c.params.id ?? "")
  if (!row) throw fail(404, "not_found")
  const input: Record<string, unknown> = await c.body(
    taxonomyPatchSchemas[type]
  )
  // The site always shows at least one vehicle type and one country.
  if (
    (type === "vehicle-types" || type === "countries") &&
    input.enabled === false &&
    !rows().some((r) => r !== row && r.enabled)
  )
    throw fail(409, "last_shown")
  return Object.assign(row, input)
})

route(
  "GET",
  "/admin/banners",
  (c) => (
    admin(c),
    z
      .array(bannerSchema)
      .parse([...db.banners].sort((a, b) => a.sortOrder - b.sortOrder))
  )
)
route("POST", "/admin/banners", async (c) => {
  admin(c)
  return bannerSchema.parse(
    insert(db.banners, {
      id: newId("bn"),
      ...(await c.body(bannerInputSchema)),
      impressions: 0,
      clicks: 0,
    })
  )
})
route("PATCH", "/admin/banners/:id", async (c) => {
  admin(c)
  const row = find(db.banners, c.params.id ?? "")
  if (!row) throw fail(404, "not_found")
  Object.assign(row, await c.body(bannerInputSchema.partial()))
  return bannerSchema.parse(row)
})
route("DELETE", "/admin/banners/:id", (c) => {
  admin(c)
  if (!remove(db.banners, c.params.id ?? "")) throw fail(404, "not_found")
  return ack()
})

route("GET", "/admin/pages/:slug", (c) => {
  admin(c)
  const row = db.pages.find((p) => p.slug === c.params.slug)
  if (!row) throw fail(404, "not_found")
  return sitePageSchema.parse(row)
})
route("PATCH", "/admin/pages/:slug", async (c) => {
  admin(c)
  const row = db.pages.find((p) => p.slug === c.params.slug)
  if (!row) throw fail(404, "not_found")
  Object.assign(row, await c.body(pagePatchSchema), { updatedAt: nowIso() })
  return sitePageSchema.parse(row)
})

route(
  "GET",
  "/admin/settings",
  (c) => (admin(c), settingsSchema.parse(db.settings))
)
route("PATCH", "/admin/settings", async (c) => {
  admin(c)
  Object.assign(db.settings, await c.body(settingsPatchSchema))
  syncFreeLimit()
  return settingsSchema.parse(db.settings)
})

const BACKUP_MS = 2000
const RESTORE_MS = 1500
route("GET", "/admin/backups", (c) => {
  admin(c)
  for (const b of db.backups)
    if (
      b.status === "running" &&
      Date.now() - Date.parse(b.createdAt) >= BACKUP_MS
    )
      b.status = "ready"
  return z.array(backupSchema).parse([...db.backups].sort(byNewest))
})
route("POST", "/admin/backups", (c) => {
  admin(c)
  return backupSchema.parse(
    insert(db.backups, {
      id: newId("bk"),
      createdAt: nowIso(),
      sizeMb: 40 + db.backups.length,
      type: "manual",
      status: "running",
      snapshot: takeSnapshot(),
    })
  )
})
// Puts the data back as it was when the backup was taken; the wait stands in for the real restore.
route("POST", "/admin/backups/:id/restore", async (c) => {
  admin(c)
  const backup = find(db.backups, c.params.id ?? "")
  if (!backup) throw fail(404, "not_found")
  if (backup.status !== "ready") throw fail(409, "conflict")
  await new Promise((resolve) => setTimeout(resolve, RESTORE_MS))
  restoreDb(backup.snapshot)
  return ack()
})
