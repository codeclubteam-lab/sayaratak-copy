// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest"

import { db, resetDb } from "@/mocks/db"
import { handleMock } from "@/mocks/router"

type Opts = { as?: string; body?: unknown }
async function call(method: string, path: string, o: Opts = {}) {
  const headers: Record<string, string> = {}
  if (o.as) headers.cookie = `sy_session=${o.as}`
  if (o.body !== undefined) headers["content-type"] = "application/json"
  const res = await handleMock(
    new Request(`http://localhost/api${path}`, {
      method,
      headers,
      body: o.body !== undefined ? JSON.stringify(o.body) : undefined,
    })
  )
  return { status: res.status, body: await res.json() }
}

beforeEach(() => resetDb())

// Contract changes from the fourth audit of the blueprint (A7, A8, A9).
describe("listings for rails", () => {
  it("limit caps the page, exclude drops one listing, featured keeps Featured promotions", async () => {
    const five = await call("GET", "/listings?limit=5")
    expect(five.body.items).toHaveLength(5)
    expect(five.body.pageSize).toBe(5)
    // The cap is 24, the default is 24.
    expect((await call("GET", "/listings?limit=99")).body.items).toHaveLength(
      24
    )
    const first = five.body.items[0].id
    const rest = await call("GET", `/listings?limit=5&exclude=${first}`)
    expect(rest.body.items.some((l: { id: string }) => l.id === first)).toBe(
      false
    )
    const featured = await call("GET", "/listings?featured=true&limit=24")
    expect(featured.body.items.length).toBeGreaterThan(0)
    for (const l of featured.body.items) {
      const kinds = l.promotions.map((p: { type: string }) => p.type)
      expect(kinds).toContain("featured")
    }
  })
})

describe("listing visibility and location", () => {
  const owned = () =>
    db.listings.find(
      (l) =>
        l.moderation === "approved" && l.location && l.ownerUserId === "u-omar"
    )!

  it("rounds the position for everyone but the owner and admins", async () => {
    const row = owned()
    const round = (n: number) => Math.round(n * 100) / 100
    const anon = await call("GET", `/listings/${row.slug}`)
    expect(anon.body.location).toEqual({
      lat: round(row.location!.lat),
      lng: round(row.location!.lng),
    })
    expect(
      (await call("GET", `/listings/${row.slug}`, { as: "u-omar" })).body
        .location
    ).toEqual(row.location)
    expect(
      (await call("GET", `/listings/${row.slug}`, { as: "u-admin" })).body
        .location
    ).toEqual(row.location)
    const inList = (
      await call(
        "GET",
        "/listings?limit=24&q=" +
          encodeURIComponent(row.title.split(" ")[0] ?? "")
      )
    ).body.items.find((l: { id: string }) => l.id === row.id)
    if (inList) expect(inList.location).toEqual(anon.body.location)
  })

  it("hides the listings of a banned owner or a suspended business from everyone but the owner and admins", async () => {
    const row = owned()
    expect((await call("GET", `/listings/${row.slug}`)).status).toBe(200)
    db.users.find((u) => u.id === "u-omar")!.banned = true
    expect((await call("GET", `/listings/${row.slug}`)).status).toBe(404)
    expect(
      (await call("GET", `/listings/${row.slug}`, { as: "u-admin" })).status
    ).toBe(200)
    const search = await call("GET", "/listings?limit=24&seller=u-omar")
    expect(search.body.items).toHaveLength(0)

    resetDb()
    const dealerListing = db.listings.find(
      (l) => l.moderation === "approved" && l.ownerUserId === "u-dealer"
    )!
    db.dealerships.find((d) => d.ownerId === "u-dealer")!.status = "suspended"
    expect((await call("GET", `/listings/${dealerListing.slug}`)).status).toBe(
      404
    )
  })
})

describe("favorites, reviews, notifications", () => {
  it("favorite ids are public and empty when signed out", async () => {
    expect((await call("GET", "/me/favorite-ids")).body).toEqual({ ids: [] })
  })

  it("flagging a review is for the owner of the target, idempotent, and keeps it public", async () => {
    const review = db.reviews.find(
      (r) => r.status === "visible" && r.targetType === "dealership"
    )!
    const target = db.dealerships.find((d) => d.id === review.targetId)!
    expect((await call("POST", `/reviews/${review.id}/flag`)).status).toBe(401)
    expect(
      (await call("POST", `/reviews/${review.id}/flag`, { as: "u-omar" }))
        .status
    ).toBe(403)
    const owner = db.users.find((u) => u.id === target.ownerId)!
    const first = await call("POST", `/reviews/${review.id}/flag`, {
      as: owner.id,
    })
    expect(first.body.status).toBe("flagged")
    expect(
      (await call("POST", `/reviews/${review.id}/flag`, { as: owner.id })).body
        .status
    ).toBe("flagged")
    const listed = await call(
      "GET",
      `/reviews?targetType=dealership&targetId=${target.id}`
    )
    expect(
      listed.body.items.some((r: { id: string }) => r.id === review.id)
    ).toBe(true)
    // An admin hiding it removes it from the list and from the rating; Show brings it back.
    const before = target.rating.count
    await call("POST", `/admin/reviews/${review.id}/hide`, { as: "u-admin" })
    expect(target.rating.count).toBe(before - 1)
    await call("POST", `/admin/reviews/${review.id}/show`, { as: "u-admin" })
    expect(target.rating.count).toBe(before)
  })

  it("ratings carry a distribution of five counts", () => {
    for (const b of [...db.dealerships, ...db.workshops, ...db.mechanics]) {
      expect(b.rating.distribution).toHaveLength(5)
      expect(b.rating.distribution.reduce((s, n) => s + n, 0)).toBe(
        b.rating.count
      )
    }
  })

  it("notifications keep both languages and filter by unread", async () => {
    const all = await call("GET", "/notifications?limit=24", { as: "u-omar" })
    expect(all.body.items[0].title).toEqual({
      ar: expect.any(String),
      en: expect.any(String),
    })
    const unread = await call("GET", "/notifications?unread=true", {
      as: "u-omar",
    })
    expect(unread.body.items.length).toBeGreaterThan(0)
    expect(unread.body.items.every((n: { readAt?: string }) => !n.readAt)).toBe(
      true
    )
    expect(unread.body.items.length).toBeLessThan(all.body.total)
  })
})

describe("workshops and subscriptions", () => {
  it("the service filter matches on the template id", async () => {
    const template = db.workshops[0]!.services[0]!.templateId!
    const res = await call("GET", `/workshops?service=${template}&limit=24`)
    expect(res.body.items.length).toBeGreaterThan(0)
    for (const w of res.body.items)
      expect(
        w.services.some(
          (s: { templateId: string }) => s.templateId === template
        )
      ).toBe(true)
  })

  it("a custom service keeps a null template id", async () => {
    const w = db.workshops.find((x) => x.ownerId === "u-workshop")!
    const res = await call("POST", "/me/services", {
      as: "u-workshop",
      body: { name: "Wheel wash", description: "", priceFrom: null },
    })
    expect(res.body.templateId).toBeNull()
    expect(w.services.at(-1)?.templateId).toBeNull()
  })

  it("the demo dealership is verified and the demo workshop and mechanic are not", () => {
    expect(db.dealerships.find((d) => d.ownerId === "u-dealer")?.verified).toBe(
      true
    )
    expect(db.workshops.find((d) => d.ownerId === "u-workshop")?.verified).toBe(
      false
    )
    expect(db.mechanics.find((d) => d.ownerId === "u-mechanic")?.verified).toBe(
      false
    )
    expect(db.settings.autoApproveVerifiedDealers).toBe(true)
    expect(
      db.verifications.some((v) => ["w-1", "m-1"].includes(v.targetId))
    ).toBe(false)
  })

  it("subscription usage follows the A7 rules", async () => {
    const dealer = (await call("GET", "/me/subscription", { as: "u-dealer" }))
      .body
    expect(dealer.usage.limit).toBe(dealer.plan.listingLimit)
    const workshop = (
      await call("GET", "/me/subscription", { as: "u-workshop" })
    ).body
    expect(workshop.usage.limit).toBeNull()
    const none = (await call("GET", "/me/subscription", { as: "u-new" })).body
    expect(none.subscription).toBeNull()
    expect(none.plan).toBeNull()
    expect(none.usage.limit).toBe(db.settings.freeListingLimit)
  })

  it("listing tabs follow the 8.2 rules", async () => {
    const active = await call("GET", "/me/listings?tab=active&pageSize=500", {
      as: "u-omar",
    })
    for (const l of active.body.items) {
      expect(l.moderation).toBe("approved")
      expect(["available", "reserved"]).toContain(l.status)
    }
    const drafts = await call("GET", "/me/listings?tab=drafts", {
      as: "u-omar",
    })
    for (const l of drafts.body.items) expect(l.moderation).toBe("draft")
  })

  it("the owner's table sorts, filters by type and intent, and finds an id", async () => {
    const get = async (query: string) =>
      (
        await call("GET", `/me/listings?pageSize=500&${query}`, {
          as: "u-omar",
        })
      ).body.items
    const cheap = await get("sort=price&dir=asc")
    const prices: number[] = cheap.map((l: { price: number }) => l.price)
    expect(prices).toEqual([...prices].sort((a, b) => a - b))
    const views = await get("sort=views&dir=desc")
    const counts: number[] = views.map(
      (l: { stats: { views: number } }) => l.stats.views
    )
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
    for (const l of await get("type=truck")) expect(l.vehicleType).toBe("truck")
    for (const l of await get("intent=rent")) expect(l.intent).toBe("rent")
    const [first] = await get("")
    const found = await get(`q=${first.id}`)
    expect(found.map((l: { id: string }) => l.id)).toContain(first.id)
    const all = await get("")
    expect(
      all.every((l: { moderation: string }) => l.moderation !== "removed")
    ).toBe(true)
  })

  it("renew adds the listing duration to the later of now and the current end", async () => {
    const row = db.listings.find(
      (l) => l.ownerUserId === "u-omar" && l.moderation === "approved"
    )!
    const day = 86_400_000
    const end = Date.now() + 20 * day
    row.expiresAt = new Date(end).toISOString()
    await call("POST", `/listings/${row.id}/renew`, { as: "u-omar" })
    expect(Date.parse(row.expiresAt)).toBe(
      end + db.settings.listingExpiryDays * day
    )
    row.expiresAt = new Date(Date.now() - 5 * day).toISOString()
    const before = Date.now()
    await call("POST", `/listings/${row.id}/renew`, { as: "u-omar" })
    expect(Date.parse(row.expiresAt)).toBeGreaterThanOrEqual(
      before + db.settings.listingExpiryDays * day
    )
  })
})

describe("site and admin extras", () => {
  it("GET /site is public and carries contact details and locales", async () => {
    const site = await call("GET", "/site")
    expect(site.body.contact.phone).toBe(db.settings.contact.phone)
    expect(site.body.locales).toEqual(db.settings.locales)
  })

  it("assigning a plan copies a custom price, limit and duration into the subscription", async () => {
    const business = db.dealerships.find((d) => d.ownerId === "u-dealer")!
    await call("POST", `/admin/businesses/${business.id}/assign-plan`, {
      as: "u-admin",
      body: {
        planId: "plan-dealer-pro",
        price: 1000,
        limit: 7,
        durationDays: 10,
      },
    })
    const sub = (await call("GET", "/me/subscription", { as: "u-dealer" })).body
    expect(sub.subscription.price).toBe(1000)
    expect(sub.usage.limit).toBe(7)
  })
})
