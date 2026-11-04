// @vitest-environment node
import { describe, expect, it } from "vitest"
import type { z } from "zod"

import { buildSeed } from "@/mocks/seed"
import {
  bannerSchema,
  backupSchema,
  reportSchema,
  settingsSchema,
  sitePageSchema,
  verificationRequestSchema,
} from "@sayaratak/shared/schemas/admin"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import {
  messageSchema,
  notificationSchema,
} from "@sayaratak/shared/schemas/messaging"
import {
  paymentSchema,
  planSchema,
  promotionPriceSchema,
  promotionSchema,
  subscriptionSchema,
} from "@sayaratak/shared/schemas/billing"
import {
  dealershipSchema,
  mechanicSchema,
  workshopSchema,
} from "@sayaratak/shared/schemas/profile"
import { reviewSchema } from "@sayaratak/shared/schemas/review"
import { savedSearchSchema } from "@sayaratak/shared/schemas/saved-search"
import { taxonomySchema } from "@sayaratak/shared/schemas/taxonomy"
import { userSchema } from "@sayaratak/shared/schemas/user"

const db = buildSeed()
const count = <T>(rows: T[], f: (r: T) => boolean) => rows.filter(f).length

describe("seed counts (A9)", () => {
  it("listings", () => {
    expect(db.listings).toHaveLength(320)
    const approved = db.listings.filter((l) => l.moderation === "approved")
    expect(
      count(approved, (l) => l.vehicleType === "car" && l.intent === "sale")
    ).toBe(140)
    expect(
      count(approved, (l) => l.vehicleType === "car" && l.intent === "rent")
    ).toBe(40)
    expect(count(approved, (l) => l.vehicleType === "truck")).toBe(30)
    expect(count(approved, (l) => l.vehicleType === "motorcycle")).toBe(25)
    expect(
      count(
        approved,
        (l) => l.vehicleType === "tuk_tuk" || l.vehicleType === "rickshaw"
      )
    ).toBe(25)
    expect(count(approved, (l) => l.kind === "part")).toBe(40)
    expect(db.listings.length - approved.length).toBe(20)
  })
  it("people and content", () => {
    expect(db.dealerships).toHaveLength(12)
    expect(count(db.dealerships, (d) => d.verified)).toBe(8)
    expect(db.workshops).toHaveLength(14)
    expect(count(db.workshops, (d) => d.verified)).toBe(9)
    expect(db.mechanics).toHaveLength(18)
    expect(count(db.mechanics, (d) => d.verified)).toBe(10)
    expect(db.reviews).toHaveLength(120)
    // 25 draws; two repeat a pair and subject and join the first thread (one thread per pair, as POST /threads).
    expect(db.threads).toHaveLength(23)
    const pairs = db.threads.map((t) =>
      [t.subjectType, t.subjectId, ...[...t.participantIds].sort()].join(":")
    )
    expect(new Set(pairs).size).toBe(pairs.length)
    expect(db.reports).toHaveLength(6)
    expect(db.verifications).toHaveLength(6)
    expect(db.banners).toHaveLength(7)
    expect(db.pages).toHaveLength(4)
    expect(db.backups).toHaveLength(5)
    expect(
      db.payments.filter((p) => p.status === "pending_review")
    ).toHaveLength(5)
    expect(
      db.payments.filter((p) => p.status !== "pending_review")
    ).toHaveLength(8)
    expect(db.taxonomy.cities).toHaveLength(10)
    expect(db.taxonomy.makes).toHaveLength(55)
    for (const id of [
      "u-omar",
      "u-dealer",
      "u-workshop",
      "u-mechanic",
      "u-admin",
    ]) {
      // The admin only receives announcements, so the seed gives three.
      expect(db.notifications.filter((n) => n.userId === id)).toHaveLength(
        id === "u-admin" ? 3 : 12
      )
    }
    expect(
      db.users.find((u) => u.email === "new@demo.sy")?.onboardingDone
    ).toBe(false)
  })
  it("is deterministic apart from the clock", () => {
    const again = buildSeed()
    expect(again.listings.map((l) => l.slug)).toEqual(
      db.listings.map((l) => l.slug)
    )
  })
})

describe("rows parse with their schemas", () => {
  const cases: [string, unknown[], z.ZodTypeAny][] = [
    ["users", db.users, userSchema.omit({ hasPassword: true })],
    ["listings", db.listings, listingSchema],
    ["dealerships", db.dealerships, dealershipSchema],
    ["workshops", db.workshops, workshopSchema],
    ["mechanics", db.mechanics, mechanicSchema],
    ["reviews", db.reviews, reviewSchema],
    ["messages", db.messages, messageSchema],
    ["notifications", db.notifications, notificationSchema],
    ["savedSearches", db.savedSearches, savedSearchSchema],
    ["plans", db.plans, planSchema],
    ["subscriptions", db.subscriptions, subscriptionSchema],
    ["payments", db.payments, paymentSchema],
    ["promotions", db.promotions, promotionSchema],
    ["promotionPrices", db.promotionPrices, promotionPriceSchema],
    ["reports", db.reports, reportSchema],
    ["verifications", db.verifications, verificationRequestSchema],
    ["banners", db.banners, bannerSchema],
    ["pages", db.pages, sitePageSchema],
    ["backups", db.backups, backupSchema],
  ]
  it.each(cases)("%s", (_, rows, schema) => {
    expect(rows.length).toBeGreaterThan(0)
    for (const row of rows) expect(schema.safeParse(row).error).toBeUndefined()
  })
  it("taxonomy and settings", () => {
    expect(taxonomySchema.safeParse(db.taxonomy).success).toBe(true)
    expect(settingsSchema.safeParse(db.settings).success).toBe(true)
  })
})

describe("foreign keys resolve", () => {
  const ids = (rows: { id: string }[]) => new Set(rows.map((r) => r.id))
  const cities = new Set(db.taxonomy.cities.map((c) => c.id))
  const districts = new Set(db.taxonomy.districts.map((d) => d.id))
  const models = new Set(db.taxonomy.models.map((m) => m.id))
  const makes = new Set(db.taxonomy.makes.map((m) => m.id))
  const users = ids(db.users)
  const listings = ids(db.listings)
  const businesses = new Set(
    [...db.dealerships, ...db.workshops, ...db.mechanics].map((b) => b.id)
  )
  it("listings", () => {
    for (const l of db.listings) {
      expect(cities.has(l.cityId)).toBe(true)
      expect(l.districtId && districts.has(l.districtId)).toBeTruthy()
      expect(users.has(l.ownerUserId)).toBe(true)
      if (l.makeId) expect(makes.has(l.makeId)).toBe(true)
      if (l.modelId) expect(models.has(l.modelId)).toBe(true)
    }
  })
  it("people", () => {
    for (const b of [...db.dealerships, ...db.workshops, ...db.mechanics]) {
      expect(users.has(b.ownerId)).toBe(true)
      expect(cities.has(b.cityId)).toBe(true)
    }
    for (const u of db.users)
      if (u.cityId) expect(cities.has(u.cityId)).toBe(true)
  })
  it("activity and billing", () => {
    for (const r of db.reviews) {
      expect(users.has(r.authorId)).toBe(true)
      expect(businesses.has(r.targetId)).toBe(true)
    }
    const threadIds = ids(db.threads)
    for (const t of db.threads)
      for (const p of t.participantIds) expect(users.has(p)).toBe(true)
    for (const m of db.messages) {
      expect(threadIds.has(m.threadId)).toBe(true)
      expect(users.has(m.senderId)).toBe(true)
    }
    for (const f of db.favorites) {
      expect(users.has(f.userId)).toBe(true)
      expect(listings.has(f.listingId)).toBe(true)
    }
    for (const n of db.notifications) expect(users.has(n.userId)).toBe(true)
    const plans = ids(db.plans)
    for (const s of db.subscriptions) {
      expect(users.has(s.userId)).toBe(true)
      expect(plans.has(s.planId)).toBe(true)
    }
    for (const p of db.payments) expect(users.has(p.userId)).toBe(true)
    for (const p of db.promotions) expect(listings.has(p.listingId)).toBe(true)
    for (const r of db.reports) {
      expect(listings.has(r.listingId)).toBe(true)
      expect(users.has(r.reporterId)).toBe(true)
    }
    for (const v of db.verifications) {
      expect(businesses.has(v.targetId)).toBe(true)
      expect(users.has(v.ownerId)).toBe(true)
    }
  })
})

describe("MOCK_EMPTY mode", () => {
  it("keeps taxonomy, plans, settings, pages and the demo accounts only", () => {
    const empty = buildSeed({ empty: true })
    expect(empty.listings).toHaveLength(0)
    expect(empty.reviews).toHaveLength(0)
    expect(empty.users.map((u) => u.id)).toEqual(
      expect.arrayContaining([
        "u-omar",
        "u-dealer",
        "u-workshop",
        "u-mechanic",
        "u-admin",
        "u-new",
      ])
    )
    expect(empty.plans.length).toBeGreaterThan(0)
    expect(empty.pages).toHaveLength(4)
    expect(empty.taxonomy.cities).toHaveLength(10)
  })
})
