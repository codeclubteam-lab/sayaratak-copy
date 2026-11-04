import { beforeEach, describe, expect, test } from "bun:test"
import { reviewSchema } from "@sayaratak/shared/schemas/review"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { user } from "~/modules/auth/auth.tables"

import { expectSchema, req, resetDb, signIn } from "../../../tests/helpers"
import { idsOf, list, pageSchema, post, review } from "../../../tests/reviews"
import { reviews } from "./reviews.tables"

beforeEach(resetDb)

describe("GET /reviews", () => {
  test("answers the shown reviews of a business, newest first, in the shared page", async () => {
    const page = await expectSchema(
      await list("targetType=workshop&targetId=w-1"),
      pageSchema
    )
    expect(page).toMatchObject({ total: 3, page: 1, pageSize: 10 })
    const dates = page.items.map((r) => r.createdAt)
    expect(dates).toEqual([...dates].sort().reverse())
  })

  test("pages with page and pageSize", async () => {
    const page = await expectSchema(
      await list("targetType=workshop&targetId=w-1&page=2&pageSize=2"),
      pageSchema
    )
    expect(page).toMatchObject({ total: 3, page: 2, pageSize: 2 })
    expect(page.items).toHaveLength(1)
  })

  test("is 422 without a target", async () => {
    const res = await list("targetType=workshop")
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      code: "validation",
      fields: { targetId: "validation.required" },
    })
  })

  test("gives the owner the hidden reviews and the unanswered ones, and nobody else", async () => {
    const shop = await signIn("workshop")
    const target = "targetType=workshop&targetId=w-1"
    expect(
      await idsOf(await list(`${target}&includeHidden=true`, shop))
    ).toEqual(["r-114", "r-115", "r-19", "r-70", "r-93"])
    // A hidden review never needs a reply.
    expect(
      await idsOf(
        await list(`${target}&includeHidden=true&needsReply=true`, shop)
      )
    ).toEqual(["r-19", "r-70", "r-93"])
    const visitor = await signIn("user")
    expect(
      await idsOf(await list(`${target}&includeHidden=true`, visitor))
    ).toEqual(["r-19", "r-70", "r-93"])
    expect(await idsOf(await list(`${target}&includeHidden=true`))).toEqual([
      "r-19",
      "r-70",
      "r-93",
    ])
  })
})

describe("POST /reviews", () => {
  test("adds a visible review under the author's name and keeps the business's own kind", async () => {
    const buyer = await signIn("user")
    const res = await post(buyer, { ...review, targetType: "workshop" })
    expect(res.status).toBe(200)
    const saved = await expectSchema(res, reviewSchema)
    expect(saved).toMatchObject({
      targetType: "dealership",
      targetId: "d-1",
      authorId: "u-omar",
      rating: 4,
      status: "visible",
    })
    expect(saved.reply).toBeUndefined()
    const page = await expectSchema(
      await list("targetType=dealership&targetId=d-1"),
      pageSchema
    )
    expect(page.items[0]?.id).toBe(saved.id)
    expect(page.total).toBe(3)
  })

  test("is 401 signed out, 403 banned, 404 for an unknown business, 403 for its own owner", async () => {
    expect((await req("/reviews", { method: "POST" })).status).toBe(401)
    const dealer = await signIn("dealership")
    expect(await (await post(dealer, review)).json()).toMatchObject({
      code: "forbidden",
    })
    const buyer = await signIn("user")
    expect(
      await (await post(buyer, { ...review, targetId: "d-x" })).json()
    ).toMatchObject({ code: "not_found" })
    await db.update(user).set({ banned: true }).where(eq(user.id, "u-omar"))
    expect(await (await post(buyer, review)).json()).toMatchObject({
      code: "banned",
    })
  })

  test("is 422 for a rating out of range and a short text", async () => {
    const buyer = await signIn("user")
    const res = await post(buyer, { ...review, rating: 6, body: "short" })
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({
      fields: { body: "validation.review_min" },
    })
  })

  test("is 409 already_reviewed for a second review, also two at once", async () => {
    const buyer = await signIn("user")
    const results = await Promise.all([
      post(buyer, review),
      post(buyer, review),
    ])
    expect(results.map((r) => r.status).sort()).toEqual([200, 409])
    const second = await post(buyer, { ...review, rating: 1 })
    expect(await second.json()).toMatchObject({ code: "already_reviewed" })
    expect(await db.$count(reviews, eq(reviews.authorId, "u-omar"))).toBe(1)
  })
})
