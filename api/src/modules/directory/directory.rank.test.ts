import { beforeEach, describe, expect, test } from "bun:test"
import { dealershipSchema } from "@sayaratak/shared/schemas/profile"
import { and, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { dealerships, mechanics } from "~/modules/businesses/businesses.tables"
import { listings } from "~/modules/listings/listings.tables"
import { subscriptions } from "~/modules/plans/plans.tables"
import { reviews } from "~/modules/reviews/reviews.tables"

import { expectSchema, req, resetDb } from "../../../tests/helpers"

beforeEach(resetDb)

type Page = { items: { id: string; slug: string }[]; total: number }
const list = async (path: string) => (await (await req(path)).json()) as Page

// Ends the owner's subscription, if any, and starts a paid mechanic plan.
async function makePaid(ownerUserId: string) {
  await db
    .update(subscriptions)
    .set({ status: "canceled" })
    .where(eq(subscriptions.userId, ownerUserId))
  await db.insert(subscriptions).values({
    id: `sub-paid-${ownerUserId}`,
    userId: ownerUserId,
    planId: "plan-mechanic-plus",
    status: "active",
    startsAt: new Date(),
    endsAt: new Date(Date.now() + 86_400_000),
    price: 60_000,
  })
}

const ownerOf = async (id: string | undefined) => {
  const [row] = await db
    .select()
    .from(mechanics)
    .where(eq(mechanics.id, id ?? ""))
  return row?.ownerUserId ?? ""
}

describe("mechanics, paid plans first", () => {
  test("puts a mechanic on a paid plan first in every sort", async () => {
    const order = await list("/mechanics?pageSize=100&sort=newest")
    const last = order.items.at(-1)
    await makePaid(await ownerOf(last?.id))
    for (const sort of ["rating", "experience", "newest"]) {
      const sorted = await list(`/mechanics?pageSize=100&sort=${sort}`)
      expect(sorted.items[0]?.id).toBe(last?.id)
    }
  })

  test("keeps the order the sort gave inside the paid group and the free group", async () => {
    const before = (await list("/mechanics?pageSize=100&sort=experience")).items
    const second = before[1]
    await makePaid(await ownerOf(second?.id))
    const after = (await list("/mechanics?pageSize=100&sort=experience")).items
    expect(after[0]?.id).toBe(second?.id)
    expect(after.slice(1).map((m) => m.id)).toEqual(
      before.filter((m) => m.id !== second?.id).map((m) => m.id)
    )
  })
})

describe("what a profile shows from other modules", () => {
  test("counts shown reviews into the rating and leaves hidden ones out", async () => {
    const [dealer] = await db.select().from(dealerships).limit(1)
    await db.delete(reviews).where(eq(reviews.targetId, dealer?.id ?? ""))
    const add = (stars: number, status: "visible" | "hidden" | "flagged") =>
      db.insert(reviews).values({
        id: `rv-${stars}-${status}`,
        targetType: "dealership",
        targetId: dealer?.id ?? "",
        authorName: "A buyer",
        rating: stars,
        status,
        createdAt: new Date(),
      })
    await add(5, "visible")
    await add(4, "flagged")
    await add(1, "hidden")
    const res = await req(`/dealerships/${dealer?.slug}`)
    const shown = await expectSchema(res, dealershipSchema)
    // A flagged review stays public until an admin hides it.
    expect(shown.rating).toEqual({
      avg: 4.5,
      count: 2,
      distribution: [0, 0, 0, 1, 1],
    })
  })

  test("counts only approved listings that are still available as inventory", async () => {
    const [dealer] = await db.select().from(dealerships).limit(1)
    const mine = and(eq(listings.ownerUserId, dealer?.ownerUserId ?? ""))
    const read = async () =>
      (
        await expectSchema(
          await req(`/dealerships/${dealer?.slug}`),
          dealershipSchema
        )
      ).inventoryCount
    const approved = (
      await db
        .select()
        .from(listings)
        .where(
          and(
            mine,
            eq(listings.moderation, "approved"),
            eq(listings.status, "available")
          )
        )
    ).length
    expect(await read()).toBe(approved)
    expect(approved).toBeGreaterThan(0)
    const [one] = await db
      .select()
      .from(listings)
      .where(
        and(
          mine,
          eq(listings.moderation, "approved"),
          eq(listings.status, "available")
        )
      )
      .limit(1)
    await db
      .update(listings)
      .set({ status: "sold" })
      .where(eq(listings.id, one?.id ?? ""))
    expect(await read()).toBe(approved - 1)
  })

  test("sorts dealerships by inventory", async () => {
    const page = await list("/dealerships?sort=listings&pageSize=100")
    const counts = await Promise.all(
      page.items.map(
        async (item) =>
          (
            await expectSchema(
              await req(`/dealerships/${item.slug}`),
              dealershipSchema
            )
          ).inventoryCount
      )
    )
    expect(counts).toEqual([...counts].sort((a, b) => b - a))
  })
})
