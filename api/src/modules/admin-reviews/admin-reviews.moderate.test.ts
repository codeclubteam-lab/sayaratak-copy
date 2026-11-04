import { beforeEach, describe, expect, test } from "bun:test"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { reviewSchema } from "@sayaratak/shared/schemas/review"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { reviews } from "~/modules/reviews/reviews.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, req, resetDb } from "../../../tests/helpers"

// Seed: r-19 is a shown review of the workshop w-1, r-114 a hidden one of w-1, r-117 a flagged one.
const SHOWN = "r-19"
const HIDDEN = "r-114"
const FLAGGED = "r-117"

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const hide = (id: string) => call("POST", `/admin/reviews/${id}/hide`)
const show = (id: string) => call("POST", `/admin/reviews/${id}/show`)
const statusOf = (id: string) =>
  db
    .select()
    .from(reviews)
    .where(eq(reviews.id, id))
    .then(([row]) => row?.status)
const auditOf = (id: string) =>
  db.select().from(auditLog).where(eq(auditLog.targetId, id))
const publicIds = async (targetId: string) => {
  const res = await req(`/reviews?targetType=workshop&targetId=${targetId}`)
  const body = await expectSchema(res, pageOf(reviewSchema))
  return body.items.map((item) => item.id)
}

describe("POST /admin/reviews/:id/hide", () => {
  test("hides a shown review from the public list and writes the audit row", async () => {
    expect(await publicIds("w-1")).toContain(SHOWN)
    const res = await hide(SHOWN)
    expect(res.status).toBe(200)
    expect(await expectSchema(res, reviewSchema)).toMatchObject({
      id: SHOWN,
      status: "hidden",
    })
    expect(await statusOf(SHOWN)).toBe("hidden")
    expect(await publicIds("w-1")).not.toContain(SHOWN)
    const [audit] = await auditOf(SHOWN)
    expect(audit).toMatchObject({
      action: "review.hide",
      targetType: "review",
      adminId: "u-admin",
      before: { status: "visible" },
      after: { status: "hidden" },
    })
  })

  test("hides a flagged review", async () => {
    expect((await hide(FLAGGED)).status).toBe(200)
    expect(await statusOf(FLAGGED)).toBe("hidden")
    expect((await auditOf(FLAGGED))[0]?.before).toEqual({ status: "flagged" })
  })

  test("a review already hidden stays as it is and writes no second audit row", async () => {
    expect((await hide(HIDDEN)).status).toBe(200)
    expect(await statusOf(HIDDEN)).toBe("hidden")
    expect(await auditOf(HIDDEN)).toHaveLength(0)
  })

  test("answers 404 for an unknown review", async () => {
    const res = await hide("r-9999")
    expect(res.status).toBe(404)
    expect((await errorOf(res)).code).toBe("not_found")
  })
})

describe("POST /admin/reviews/:id/show", () => {
  test("shows a hidden review again", async () => {
    expect(await publicIds("w-1")).not.toContain(HIDDEN)
    const res = await show(HIDDEN)
    expect(res.status).toBe(200)
    expect(await expectSchema(res, reviewSchema)).toMatchObject({
      status: "visible",
    })
    expect(await publicIds("w-1")).toContain(HIDDEN)
    expect((await auditOf(HIDDEN))[0]).toMatchObject({
      action: "review.show",
      before: { status: "hidden" },
      after: { status: "visible" },
    })
  })

  test("showing a flagged review clears the flag", async () => {
    expect((await show(FLAGGED)).status).toBe(200)
    expect(await statusOf(FLAGGED)).toBe("visible")
  })

  test("a review already shown writes no audit row; an unknown one is 404", async () => {
    expect((await show(SHOWN)).status).toBe(200)
    expect(await auditOf(SHOWN)).toHaveLength(0)
    expect((await show("r-9999")).status).toBe(404)
  })

  test("two admins pressing Hide together leave one audit row", async () => {
    const [a, b] = await Promise.all([hide(SHOWN), hide(SHOWN)])
    expect([a.status, b.status]).toEqual([200, 200])
    expect(await auditOf(SHOWN)).toHaveLength(1)
  })
})
