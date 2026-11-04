import { beforeEach, describe, expect, test } from "bun:test"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import { and, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { listings } from "~/modules/listings/listings.tables"
import { notifications } from "~/modules/notifications/notifications.tables"
import { savedSearches } from "~/modules/saved-searches/saved-searches.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, resetDb } from "../../../tests/helpers"

// Seed: l0008d is a pending truck of u-omar, l0008e a pending car of the dealer, l0008l a
// rejected listing of u-omar, l00001 an approved one, and the first draft is not actionable.
const PENDING = "l0008d"
const PENDING_CAR = "l0008e"
const REJECTED = "l0008l"
const APPROVED = "l00001"

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const act = (id: string, action: string, body?: unknown) =>
  call("POST", `/admin/listings/${id}/${action}`, body)
const rowOf = (id: string) =>
  db
    .select()
    .from(listings)
    .where(eq(listings.id, id))
    .then(([row]) => row)
const noticesTo = (
  userId: string,
  type: "listing_approved" | "listing_rejected" | "saved_search_match"
) =>
  db
    .select()
    .from(notifications)
    .where(and(eq(notifications.userId, userId), eq(notifications.type, type)))
const auditOf = (id: string) =>
  db.select().from(auditLog).where(eq(auditLog.targetId, id))

describe("POST /admin/listings/:id/approve", () => {
  test("approves a pending listing, tells the owner and writes the audit row", async () => {
    const before = (await noticesTo("u-omar", "listing_approved")).length
    const res = await act(PENDING, "approve")
    expect(res.status).toBe(200)
    expect(await expectSchema(res, listingSchema)).toMatchObject({
      id: PENDING,
      moderation: "approved",
    })
    expect((await noticesTo("u-omar", "listing_approved")).length).toBe(
      before + 1
    )
    const [audit] = await auditOf(PENDING)
    expect(audit).toMatchObject({
      action: "listing.approve",
      targetType: "listing",
      adminId: "u-admin",
      before: { moderation: "pending" },
      after: { moderation: "approved" },
    })
  })

  test("approves a rejected listing and clears its rejection note", async () => {
    expect((await rowOf(REJECTED))?.rejectionReason).toBeTruthy()
    expect((await act(REJECTED, "approve")).status).toBe(200)
    expect((await rowOf(REJECTED))?.rejectionReason).toBeNull()
  })

  test("answers 409 `conflict` for an approved listing or a draft, and 404 for an unknown one", async () => {
    const draft = (
      await db.select().from(listings).where(eq(listings.moderation, "draft"))
    )[0]
    for (const id of [APPROVED, draft?.id ?? ""]) {
      const res = await act(id, "approve")
      expect(res.status).toBe(409)
      expect(await res.json()).toMatchObject({ code: "conflict" })
    }
    expect((await act("nope", "approve")).status).toBe(404)
    expect(await db.$count(auditLog)).toBe(0)
  })

  test("two admins approving together give one 200, one 409 and one notice", async () => {
    const before = (await noticesTo("u-omar", "listing_approved")).length
    const results = await Promise.all([
      act(PENDING, "approve"),
      act(PENDING, "approve"),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    expect((await noticesTo("u-omar", "listing_approved")).length).toBe(
      before + 1
    )
    expect(await auditOf(PENDING)).toHaveLength(1)
  })

  test("counts as a new match for a saved search with alerts", async () => {
    // ss-1 is u-omar's alert for cars for sale in Khartoum; make the dealer's pending car match it.
    await db
      .update(listings)
      .set({
        cityId: "khartoum",
        makeId: "toyota",
        vehicleType: "car",
        kind: "vehicle",
        intent: "sale",
      })
      .where(eq(listings.id, PENDING_CAR))
    const [before] = await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.id, "ss-1"))
    await act(PENDING_CAR, "approve")
    const [after] = await db
      .select()
      .from(savedSearches)
      .where(eq(savedSearches.id, "ss-1"))
    expect(after?.newCount).toBe((before?.newCount ?? 0) + 1)
    expect(
      (await noticesTo("u-omar", "saved_search_match")).length
    ).toBeGreaterThan(0)
  })
})

describe("POST /admin/listings/:id/reject", () => {
  test("needs a reason", async () => {
    const res = await act(PENDING, "reject", { reason: "  " })
    expect(res.status).toBe(422)
    expect((await errorOf(res)).fields).toHaveProperty("reason")
    expect((await rowOf(PENDING))?.moderation).toBe("pending")
  })

  test("rejects with the reason, tells the owner what it was and audits it", async () => {
    const res = await act(PENDING, "reject", { reason: "Blurry photos" })
    expect(res.status).toBe(200)
    expect(await expectSchema(res, listingSchema)).toMatchObject({
      moderation: "rejected",
      rejectionReason: "Blurry photos",
    })
    const notices = await noticesTo("u-omar", "listing_rejected")
    expect(notices.map((n) => n.body)).toContainEqual({
      ar: "Blurry photos",
      en: "Blurry photos",
    })
    expect((await auditOf(PENDING))[0]).toMatchObject({
      action: "listing.reject",
      reason: "Blurry photos",
    })
  })

  test("takes an approved listing back, but not a rejected one", async () => {
    expect((await act(APPROVED, "reject", { reason: "Scam" })).status).toBe(200)
    expect((await act(APPROVED, "reject", { reason: "Scam" })).status).toBe(409)
  })
})

describe("POST /admin/listings/:id/remove and restore", () => {
  test("removes silently, and a removed listing cannot be removed again", async () => {
    const owner = (await rowOf(APPROVED))?.ownerUserId ?? ""
    const before = (
      await db
        .select()
        .from(notifications)
        .where(eq(notifications.userId, owner))
    ).length
    expect((await act(APPROVED, "remove")).status).toBe(200)
    expect((await rowOf(APPROVED))?.moderation).toBe("removed")
    expect(
      (
        await db
          .select()
          .from(notifications)
          .where(eq(notifications.userId, owner))
      ).length
    ).toBe(before)
    expect((await act(APPROVED, "remove")).status).toBe(409)
  })

  test("restores only a removed listing, as approved, and tells the owner", async () => {
    expect((await act(APPROVED, "restore")).status).toBe(409)
    await act(APPROVED, "remove")
    const res = await act(APPROVED, "restore")
    expect(res.status).toBe(200)
    expect((await expectSchema(res, listingSchema)).moderation).toBe("approved")
    expect((await auditOf(APPROVED)).map((a) => a.action).sort()).toEqual([
      "listing.remove",
      "listing.restore",
    ])
  })
})
