import { beforeEach, describe, expect, test } from "bun:test"
import { and, eq, inArray } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { settings } from "~/modules/content/content.tables"
import { subscriptions } from "~/modules/plans/plans.tables"

import { carBody, send, uploadPhotos } from "../../../tests/listings"
import { DEMO_IDS, resetDb, signIn } from "../../../tests/helpers"
import { listings } from "./listings.tables"

beforeEach(resetDb)

const create = (as: Awaited<ReturnType<typeof signIn>>, body: unknown) =>
  send(as, "/listings", { method: "POST", body })

describe("POST /listings, plan limit", () => {
  test("returns 403 limit_reached at the plan limit; a draft still saves", async () => {
    const omar = await signIn("user")
    await db.update(settings).set({ individualSubscriptionsEnabled: true })
    await db
      .update(subscriptions)
      .set({ listingLimit: 0 })
      .where(
        and(
          eq(subscriptions.userId, DEMO_IDS.user),
          eq(subscriptions.status, "active")
        )
      )
    await db.update(settings).set({ freeListingLimit: 0 })
    const full = await create(omar, carBody(await uploadPhotos(omar)))
    expect(full.status).toBe(403)
    expect(await full.json()).toMatchObject({ code: "limit_reached" })
    const draft = await create(omar, {
      title: "x",
      price: 1,
      cityId: "khartoum",
      submit: false,
    })
    expect(draft.status).toBe(200)
  })

  test("two parallel submits with one place left: exactly one passes", async () => {
    const omar = await signIn("user")
    const now = new Date()
    // Omar on the free limit, with exactly one place left.
    await db.update(settings).set({ individualSubscriptionsEnabled: true })
    await db
      .delete(subscriptions)
      .where(eq(subscriptions.userId, DEMO_IDS.user))
    // Count only rows that have not expired, as the limit does.
    const counted = await db
      .select({ id: listings.id, expiresAt: listings.expiresAt })
      .from(listings)
      .where(
        and(
          eq(listings.ownerUserId, DEMO_IDS.user),
          inArray(listings.moderation, ["pending", "approved"]),
          inArray(listings.status, ["available", "reserved"])
        )
      )
    const used = counted.filter((row) => row.expiresAt > now).length
    await db.update(settings).set({ freeListingLimit: used + 1 })
    const [a, b] = [await uploadPhotos(omar), await uploadPhotos(omar)]
    const answers = await Promise.all([
      create(omar, carBody(a)),
      create(omar, carBody(b)),
    ])
    expect(answers.map((res) => res.status).sort()).toEqual([200, 403])
  })
})
