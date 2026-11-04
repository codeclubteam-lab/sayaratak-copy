import { beforeEach, describe, expect, it } from "bun:test"
import { and, eq, inArray } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { dealerships } from "~/modules/businesses/businesses.tables"
import { favorites } from "~/modules/favorites/favorites.tables"
import { listings } from "~/modules/listings/listings.tables"
import {
  threadParticipants,
  threads,
} from "~/modules/messaging/messaging.tables"
import { payments } from "~/modules/payments/payments.tables"
import { promotions } from "~/modules/promotions/promotions.tables"
import { reviews } from "~/modules/reviews/reviews.tables"

import { req, resetDb, type SignedIn, signIn } from "../../../tests/helpers"
import { user } from "./auth.tables"

function deleteMe(as: SignedIn) {
  return req("/me", {
    method: "DELETE",
    headers: { cookie: as.cookie, origin: as.origin },
  })
}

function threadIdsOf(userId: string) {
  return db
    .select({ id: threadParticipants.threadId })
    .from(threadParticipants)
    .where(eq(threadParticipants.userId, userId))
    .then((rows) => rows.map((row) => row.id))
}

beforeEach(resetDb)

describe("DELETE /me", () => {
  it("returns 403 forbidden for an admin", async () => {
    const res = await deleteMe(await signIn("admin"))
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "forbidden" })
  })

  it("returns 401 signed out", async () => {
    expect((await req("/me", { method: "DELETE" })).status).toBe(401)
  })

  it("deletes the person, frees the email and clears the cookie", async () => {
    const omar = await signIn("user")
    const res = await deleteMe(omar)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ ok: true })
    expect(res.headers.getSetCookie().join()).toContain("Max-Age=0")
    const me = await req("/me", { headers: { cookie: omar.cookie } })
    expect(await me.json()).toBeNull()
    const left = await db.$count(user, eq(user.email, "user@demo.sy"))
    expect(left).toBe(0)
  })

  it("keeps listings marked removed, ends their promotions, rejects pending receipts, drops threads and favorites", async () => {
    const dealer = await signIn("dealership")
    const owned = await db
      .select({ id: listings.id })
      .from(listings)
      .where(eq(listings.ownerUserId, "u-dealer"))
    const pending = await db
      .select({ id: payments.id })
      .from(payments)
      .where(
        and(
          eq(payments.userId, "u-dealer"),
          eq(payments.status, "pending_review")
        )
      )
      .then((rows) => rows.map((row) => row.id))
    const threadIds = await threadIdsOf("u-dealer")
    const active = await db.$count(
      promotions,
      and(
        inArray(
          promotions.listingId,
          owned.map((row) => row.id)
        ),
        eq(promotions.status, "active")
      )
    )
    expect(active).toBeGreaterThan(0)
    expect(owned.length).toBeGreaterThan(0)
    expect(threadIds.length).toBeGreaterThan(0)
    expect(pending.length).toBeGreaterThan(0)

    expect((await deleteMe(dealer)).status).toBe(200)

    const kept = await db
      .select({ moderation: listings.moderation, owner: listings.ownerUserId })
      .from(listings)
      .where(
        inArray(
          listings.id,
          owned.map((row) => row.id)
        )
      )
    expect(kept).toHaveLength(owned.length)
    expect(
      kept.every((row) => row.moderation === "removed" && !row.owner)
    ).toBe(true)
    const after = await db
      .select({ status: payments.status, reason: payments.rejectionReason })
      .from(payments)
      .where(inArray(payments.id, pending))
    expect(after).toEqual(
      pending.map(() => ({ status: "rejected", reason: "account_deleted" }))
    )
    expect(await db.$count(threads, inArray(threads.id, threadIds))).toBe(0)
    expect(await db.$count(favorites, eq(favorites.userId, "u-dealer"))).toBe(0)
    const running = await db.$count(
      promotions,
      and(
        inArray(
          promotions.listingId,
          owned.map((row) => row.id)
        ),
        eq(promotions.status, "active")
      )
    )
    expect(running).toBe(0)
  })

  it("takes the business profile and the reviews of it", async () => {
    const [business] = await db
      .select({ id: dealerships.id })
      .from(dealerships)
      .where(eq(dealerships.ownerUserId, "u-dealer"))
    const businessId = business?.id ?? ""
    expect((await deleteMe(await signIn("dealership"))).status).toBe(200)
    expect(await db.$count(dealerships, eq(dealerships.id, businessId))).toBe(0)
    expect(await db.$count(reviews, eq(reviews.targetId, businessId))).toBe(0)
  })
})
