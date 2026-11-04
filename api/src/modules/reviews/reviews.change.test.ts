import { beforeEach, describe, expect, test } from "bun:test"
import { okSchema } from "@sayaratak/shared/schemas/api"
import { reviewSchema } from "@sayaratak/shared/schemas/review"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"

import {
  call,
  expectSchema,
  resetDb,
  type SignedIn,
  signIn,
} from "../../../tests/helpers"
import { idsOf, list, post, review } from "../../../tests/reviews"
import { reviews } from "./reviews.tables"

beforeEach(resetDb)

describe("PATCH and DELETE /reviews/:id", () => {
  const mine = async (buyer: SignedIn) =>
    (await expectSchema(await post(buyer, review), reviewSchema)).id

  test("the author changes the fields sent, and sending none changes nothing", async () => {
    const buyer = await signIn("user")
    const id = await mine(buyer)
    const edit = (body: object) =>
      call(buyer, `/reviews/${id}`, { method: "PATCH", body })
    expect(
      await expectSchema(await edit({ rating: 2 }), reviewSchema)
    ).toMatchObject({
      rating: 2,
    })
    const text = "Slow answers but a fair price"
    expect(
      await expectSchema(await edit({ body: text }), reviewSchema)
    ).toMatchObject({
      rating: 2,
      body: text,
    })
    expect(await expectSchema(await edit({}), reviewSchema)).toMatchObject({
      rating: 2,
      body: text,
    })
  })

  test("is 403 for another account, 404 for an unknown id, 422 for a bad rating", async () => {
    const buyer = await signIn("user")
    const id = await mine(buyer)
    const shop = await signIn("workshop")
    const other = call(shop, `/reviews/${id}`, {
      method: "PATCH",
      body: { rating: 1 },
    })
    expect((await other).status).toBe(403)
    expect(
      (await call(buyer, "/reviews/r-nope", { method: "PATCH", body: {} }))
        .status
    ).toBe(404)
    expect(
      (
        await call(buyer, `/reviews/${id}`, {
          method: "PATCH",
          body: { rating: 0 },
        })
      ).status
    ).toBe(422)
  })

  test("the author deletes the review, then it is gone", async () => {
    const buyer = await signIn("user")
    const id = await mine(buyer)
    const res = await call(buyer, `/reviews/${id}`, { method: "DELETE" })
    await expectSchema(res, okSchema)
    expect(await db.$count(reviews, eq(reviews.id, id))).toBe(0)
    expect(
      (await call(buyer, `/reviews/${id}`, { method: "DELETE" })).status
    ).toBe(404)
  })

  test("an admin deletes any review, another account cannot", async () => {
    const buyer = await signIn("user")
    const id = await mine(buyer)
    const shop = await signIn("workshop")
    expect(
      (await call(shop, `/reviews/${id}`, { method: "DELETE" })).status
    ).toBe(403)
    const admin = await signIn("admin")
    expect(
      (await call(admin, `/reviews/${id}`, { method: "DELETE" })).status
    ).toBe(200)
    expect(await db.$count(reviews, eq(reviews.id, id))).toBe(0)
    // Only an admin deleting another person's review leaves an audit row (the author's own delete does not).
    const [audit] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.targetId, id))
    expect(audit).toMatchObject({
      action: "review.delete",
      targetType: "review",
      adminId: "u-admin",
      before: { status: "visible", rating: review.rating },
    })
  })

  test("the author's own delete leaves no audit row", async () => {
    const buyer = await signIn("user")
    const id = await mine(buyer)
    expect(
      (await call(buyer, `/reviews/${id}`, { method: "DELETE" })).status
    ).toBe(200)
    expect(await db.$count(auditLog, eq(auditLog.targetId, id))).toBe(0)
  })
})

describe("POST /reviews/:id/flag", () => {
  const flag = (as: SignedIn, id: string) =>
    call(as, `/reviews/${id}/flag`, { method: "POST" })

  test("the owner flags a shown review, which stays public; a second flag changes nothing", async () => {
    const shop = await signIn("workshop")
    expect(
      await expectSchema(await flag(shop, "r-19"), reviewSchema)
    ).toMatchObject({
      status: "flagged",
    })
    expect(
      await expectSchema(await flag(shop, "r-19"), reviewSchema)
    ).toMatchObject({
      status: "flagged",
    })
    expect(
      await idsOf(await list("targetType=workshop&targetId=w-1"))
    ).toContain("r-19")
  })

  test("leaves a hidden review hidden, and is 403 for anyone but the owner", async () => {
    const shop = await signIn("workshop")
    expect(
      await expectSchema(await flag(shop, "r-114"), reviewSchema)
    ).toMatchObject({
      status: "hidden",
    })
    const dealer = await signIn("dealership")
    expect((await flag(dealer, "r-19")).status).toBe(403)
    expect((await flag(shop, "r-nope")).status).toBe(404)
  })
})

describe("POST /reviews/:id/reply", () => {
  const reply = (as: SignedIn, id: string, body: string) =>
    call(as, `/reviews/${id}/reply`, { method: "POST", body: { body } })

  test("the owner answers, and a new answer replaces the old", async () => {
    const shop = await signIn("workshop")
    const first = await expectSchema(
      await reply(shop, "r-19", "Thank you"),
      reviewSchema
    )
    expect(first.reply?.body).toBe("Thank you")
    const second = await expectSchema(
      await reply(shop, "r-19", "Come again"),
      reviewSchema
    )
    expect(second.reply?.body).toBe("Come again")
    expect(
      await idsOf(
        await list("targetType=workshop&targetId=w-1&needsReply=true")
      )
    ).not.toContain("r-19")
  })

  test("is 409 for a hidden review, 403 for another account, 422 for a short answer", async () => {
    const shop = await signIn("workshop")
    expect(
      await (await reply(shop, "r-114", "Thank you")).json()
    ).toMatchObject({
      code: "conflict",
    })
    const dealer = await signIn("dealership")
    expect((await reply(dealer, "r-19", "Thank you")).status).toBe(403)
    expect((await reply(shop, "r-19", "x")).status).toBe(422)
    expect((await reply(shop, "r-nope", "Thank you")).status).toBe(404)
  })
})
