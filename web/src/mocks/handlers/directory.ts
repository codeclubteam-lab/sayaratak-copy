import { isOpenNow } from "@/lib/hours"
import {
  dealershipSchema,
  mechanicSchema,
  workshopSchema,
} from "@sayaratak/shared/schemas/profile"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  businessPatchSchema,
  idsInputSchema,
  imagesInputSchema,
  portfolioInputSchema,
  serviceInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import { okSchema } from "@sayaratak/shared/schemas/api"
import type { Mechanic, Workshop } from "@sayaratak/shared/schemas/profile"
import type { z } from "zod"

import { db, insert, newId, paginate } from "../db"
import { fail, needRole, pageParams, route } from "../http"
import { both } from "@/mocks/seed/util"
import {
  activePlan,
  byNewest,
  businessOf,
  listed,
  ownerBanned,
  textOf,
} from "../lib"
import { haversineKm } from "../search"

const inventory = (ownerId: string, dealerId: string) =>
  db.listings.filter(
    (l) =>
      (l.owner.id === dealerId || l.ownerUserId === ownerId) &&
      l.moderation === "approved" &&
      l.status === "available"
  ).length

const withInventory = (d: (typeof db.dealerships)[number]) =>
  dealershipSchema.parse({ ...d, inventoryCount: inventory(d.ownerId, d.id) })
// The profile of a banned owner still opens, flagged so the page shows a notice instead of contact buttons. Its numbers are left out of the answer: `noContact` is the empty contact of that kind.
const flag = (ownerId: string, noContact: object) =>
  ownerBanned(ownerId) ? { unavailable: true, ...noContact } : {}

type Sorted<T> = (a: T, b: T) => number
const rating = (
  a: { rating: { avg: number; count: number } },
  b: { rating: { avg: number; count: number } }
) => b.rating.avg - a.rating.avg || b.rating.count - a.rating.count

route("GET", "/dealerships", (c) => {
  const q = c.query.get("q")?.toLowerCase()
  const sort = c.query.get("sort")
  const sorts: Record<string, Sorted<(typeof db.dealerships)[number]>> = {
    rating,
    listings: (a, b) => inventory(b.ownerId, b.id) - inventory(a.ownerId, a.id),
    newest: byNewest,
  }
  const rows = db.dealerships
    .filter(listed)
    .filter((d) => !q || textOf(d.name).includes(q))
    .filter((d) => !c.query.get("city") || d.cityId === c.query.get("city"))
    .filter((d) => c.query.get("verified") !== "true" || d.verified)
    .sort(sorts[sort ?? "rating"] ?? rating)
  const { page, pageSize } = pageParams(c.query, 12)
  const result = paginate(rows, page, pageSize)
  return pageOf(dealershipSchema).parse({
    ...result,
    items: result.items.map(withInventory),
  })
})
route("GET", "/dealerships/:slug", (c) => {
  const row = db.dealerships.find(
    (d) => d.slug === c.params.slug && d.status === "active"
  )
  if (!row) throw fail(404, "not_found")
  return {
    ...withInventory(row),
    ...flag(row.ownerId, { phones: [], whatsapp: null }),
  }
})

route("GET", "/workshops", (c) => {
  const q = c.query.get("q")?.toLowerCase()
  const service = c.query.get("service")
  const lat = Number(c.query.get("lat"))
  const lng = Number(c.query.get("lng"))
  const km = (w: Workshop) =>
    w.location && lat && lng ? haversineKm({ lat, lng }, w.location) : Infinity
  const sorts: Record<string, Sorted<Workshop>> = {
    rating,
    newest: byNewest,
    nearest: (a, b) => km(a) - km(b),
  }
  const rows = db.workshops
    .filter(listed)
    .filter((w) => !q || textOf(w.name).includes(q))
    .filter((w) => !c.query.get("city") || w.cityId === c.query.get("city"))
    .filter((w) => !service || w.services.some((s) => s.templateId === service))
    .filter((w) => c.query.get("verified") !== "true" || w.verified)
    .filter(
      (w) => c.query.get("openNow") !== "true" || isOpenNow(w.hours, Date.now())
    )
    .sort(sorts[c.query.get("sort") ?? "rating"] ?? rating)
  const { page, pageSize } = pageParams(c.query, 12)
  return pageOf(workshopSchema).parse(paginate(rows, page, pageSize))
})
route("GET", "/workshops/:slug", (c) => {
  const row = db.workshops.find(
    (w) => w.slug === c.params.slug && w.status === "active"
  )
  if (!row) throw fail(404, "not_found")
  return workshopSchema.parse({
    ...row,
    ...flag(row.ownerId, { phone: "", whatsapp: null }),
  })
})

const isPaid = (userId: string) => (activePlan(userId)?.price ?? 0) > 0

route("GET", "/mechanics", (c) => {
  const q = c.query.get("q")?.toLowerCase()
  const spec = c.query.get("specialization")
  const sorts: Record<string, Sorted<Mechanic>> = {
    rating,
    experience: (a, b) => b.yearsOfExperience - a.yearsOfExperience,
    newest: byNewest,
  }
  const rows = db.mechanics
    .filter(listed)
    .filter((m) => !q || textOf(m.name).includes(q))
    .filter(
      (m) =>
        !c.query.get("city") ||
        m.servedCityIds.includes(c.query.get("city") ?? "")
    )
    .filter((m) => !spec || m.specializationIds.includes(spec))
    .filter(
      (m) => m.yearsOfExperience >= (Number(c.query.get("minYears")) || 0)
    )
    .filter((m) => c.query.get("verified") !== "true" || m.verified)
    .filter((m) => c.query.get("available") !== "true" || m.available)
    .sort(sorts[c.query.get("sort") ?? "rating"] ?? rating)
    // Plus promises "Top of search": mechanics on a paid plan lead every sort.
    .sort((a, b) => Number(isPaid(b.ownerId)) - Number(isPaid(a.ownerId)))
  const { page, pageSize } = pageParams(c.query, 12)
  return pageOf(mechanicSchema).parse(paginate(rows, page, pageSize))
})
route("GET", "/mechanics/:slug", (c) => {
  const row = db.mechanics.find(
    (m) => m.slug === c.params.slug && m.status === "active"
  )
  if (!row) throw fail(404, "not_found")
  return mechanicSchema.parse({
    ...row,
    ...flag(row.ownerId, { phone: "", whatsapp: null }),
  })
})

// Business self-service. The role decides which table the caller edits.
const mine = (c: Parameters<typeof needRole>[0]) => {
  const user = needRole(c, "dealership", "workshop", "mechanic")
  const biz = businessOf(user)
  if (!biz?.row) throw fail(404, "not_found")
  return { type: biz.type, row: biz.row }
}
const parseBusiness = (biz: ReturnType<typeof mine>) =>
  biz.type === "dealership"
    ? withInventory(biz.row as (typeof db.dealerships)[number])
    : biz.type === "workshop"
      ? workshopSchema.parse(biz.row)
      : mechanicSchema.parse(biz.row)

route("GET", "/me/business", (c) => parseBusiness(mine(c)))
route("PATCH", "/me/business", async (c) => {
  const biz = mine(c)
  const patch = await c.body(businessPatchSchema)
  const {
    id: _id,
    ownerId: _o,
    rating: _r,
    verified: _v,
    status: _s,
    createdAt: _c,
    slug: _sl,
    ...allowed
  } = patch
  // The form posts one string per field; it is stored in both languages (stub for translate-on-save).
  for (const key of ["name", "description", "bio"])
    if (typeof allowed[key] === "string") allowed[key] = both(allowed[key])
  const schema =
    biz.type === "dealership"
      ? dealershipSchema
      : biz.type === "workshop"
        ? workshopSchema
        : mechanicSchema
  // Checked on a copy first, so a rejected save leaves the stored profile as it was.
  const check = (schema as z.ZodType).safeParse({ ...biz.row, ...allowed })
  if (!check.success)
    throw fail(
      422,
      "validation",
      Object.fromEntries(
        check.error.issues.map((i) => [
          i.path.join("."),
          i.message.startsWith("validation.")
            ? i.message
            : "validation.required",
        ])
      )
    )
  Object.assign(biz.row, allowed)
  return parseBusiness(biz)
})

const workshop = (c: Parameters<typeof needRole>[0]) => {
  needRole(c, "workshop")
  return mine(c).row as Workshop
}
const mechanic = (c: Parameters<typeof needRole>[0]) => {
  needRole(c, "mechanic")
  return mine(c).row as Mechanic
}

route("POST", "/me/business/images", async (c) => {
  const w = workshop(c)
  const { url } = await c.body(imagesInputSchema)
  w.images.push({
    id: newId("img"),
    type: "image",
    url,
    width: 1280,
    height: 853,
    placeholderColor: "#c9d3cf",
    posterUrl: null,
  })
  return workshopSchema.parse(w)
})
route("PUT", "/me/business/images", async (c) => {
  const w = workshop(c)
  const { ids } = await c.body(idsInputSchema)
  if (ids.length > 20)
    throw fail(422, "validation", { ids: "validation.media_max" })
  // Over the plan's cap only reorder and remove pass, so a downgraded workshop keeps its photos.
  const cap = activePlan(w.ownerId)?.photoLimit
  if (cap !== undefined && ids.length > cap && ids.length > w.images.length)
    throw fail(403, "limit_reached")
  // Each id is a kept photo or a new image upload; unknown ids are dropped.
  w.images = ids.flatMap((id) => {
    const media = w.images.find((i) => i.id === id) ?? db.uploads.get(id)?.media
    return media?.type === "image" ? [media] : []
  })
  return workshopSchema.parse(w)
})

route("GET", "/me/services", (c) => workshop(c).services)
route("POST", "/me/services", async (c) => {
  const w = workshop(c)
  const input = await c.body(serviceInputSchema)
  const cap = activePlan(w.ownerId)?.serviceLimit
  if (cap !== undefined && w.services.length >= cap)
    throw fail(403, "limit_reached")
  const row = {
    id: newId("svc"),
    name: input.name,
    description: input.description ?? "",
    priceFrom: input.priceFrom ?? undefined,
    templateId: input.templateId,
  }
  w.services.push(row)
  return row
})
route("PATCH", "/me/services/:id", async (c) => {
  const w = workshop(c)
  const row = w.services.find((s) => s.id === c.params.id)
  if (!row) throw fail(404, "not_found")
  Object.assign(row, await c.body(serviceInputSchema.partial()))
  row.priceFrom ??= undefined // a cleared price comes as null; the wire field is optional
  return row
})
route("DELETE", "/me/services/:id", (c) => {
  const w = workshop(c)
  w.services = w.services.filter((s) => s.id !== c.params.id)
  return okSchema.parse({ ok: true })
})
route("POST", "/me/services/reorder", async (c) => {
  const w = workshop(c)
  const { ids } = await c.body(idsInputSchema)
  w.services = ids.flatMap((id) => w.services.filter((s) => s.id === id))
  return w.services
})

route("GET", "/me/portfolio", (c) => mechanic(c).portfolio)
route("POST", "/me/portfolio", async (c) => {
  const m = mechanic(c)
  const input = await c.body(portfolioInputSchema)
  const cap = activePlan(m.ownerId)?.portfolioLimit
  if (cap !== undefined && m.portfolio.length >= cap)
    throw fail(403, "limit_reached")
  const media = db.uploads.get(input.imageId)?.media
  if (media?.type !== "image")
    throw fail(422, "validation", { imageId: "validation.required" })
  const row = {
    id: newId("pf"),
    url: media.url,
    caption: input.caption,
    width: media.width,
    height: media.height,
    placeholderColor: media.placeholderColor,
  }
  insert(m.portfolio, row)
  return row
})
route("PATCH", "/me/portfolio/:id", async (c) => {
  const m = mechanic(c)
  const row = m.portfolio.find((p) => p.id === c.params.id)
  if (!row) throw fail(404, "not_found")
  Object.assign(row, await c.body(portfolioInputSchema.pick({ caption: true })))
  return row
})
route("DELETE", "/me/portfolio/:id", (c) => {
  const m = mechanic(c)
  m.portfolio = m.portfolio.filter((p) => p.id !== c.params.id)
  return okSchema.parse({ ok: true })
})
route("POST", "/me/portfolio/reorder", async (c) => {
  const m = mechanic(c)
  const { ids } = await c.body(idsInputSchema)
  m.portfolio = ids.flatMap((id) => m.portfolio.filter((p) => p.id === id))
  return m.portfolio
})
