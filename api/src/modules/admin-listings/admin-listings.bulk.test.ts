import { beforeEach, describe, expect, test } from "bun:test"
import { bulkResultSchema } from "@sayaratak/shared/schemas/admin"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import { eq } from "drizzle-orm"
import { z } from "zod"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { listings } from "~/modules/listings/listings.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, resetDb } from "../../../tests/helpers"

// Seed: l0008d and l0008e are pending, l0008l is rejected, l00001 is approved.
let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const bulk = async (body: unknown) => {
  const res = await call("POST", "/admin/listings/bulk", body)
  return { status: res.status, body: z.unknown().parse(await res.json()) }
}
const stateOf = async (id: string) =>
  (await db.select().from(listings).where(eq(listings.id, id)))[0]?.moderation

describe("POST /admin/listings/bulk", () => {
  test("approves what fits and skips the rest, counting only the changed", async () => {
    const draft = (
      await db.select().from(listings).where(eq(listings.moderation, "draft"))
    )[0]
    const ids = [
      "l0008d",
      "l0008e",
      "l0008l",
      "l00001",
      draft?.id ?? "",
      "nope",
    ]
    const res = await call("POST", "/admin/listings/bulk", {
      ids,
      action: "approve",
    })
    expect(res.status).toBe(200)
    expect((await expectSchema(res, bulkResultSchema)).count).toBe(3)
    expect(await stateOf(draft?.id ?? "")).toBe("draft")
    expect(await db.$count(auditLog)).toBe(3)
  })

  test("rejects only pending listings, and needs a reason", async () => {
    const missing = await call("POST", "/admin/listings/bulk", {
      ids: ["l0008d"],
      action: "reject",
    })
    expect(missing.status).toBe(422)
    expect((await errorOf(missing)).fields).toEqual({
      reason: "validation.required",
    })
    expect(await stateOf("l0008d")).toBe("pending")
    const done = await bulk({
      ids: ["l0008d", "l00001"],
      action: "reject",
      reason: "Duplicate",
    })
    expect(done.body).toEqual({ count: 1 })
    expect(await stateOf("l00001")).toBe("approved")
  })

  test("removes what is not removed, then restores only the removed", async () => {
    expect(
      (await bulk({ ids: ["l00001", "l0008d"], action: "remove" })).body
    ).toEqual({ count: 2 })
    expect(
      (await bulk({ ids: ["l00001", "l0008d"], action: "remove" })).body
    ).toEqual({ count: 0 })
    expect(
      (await bulk({ ids: ["l00001", "l0008e"], action: "restore" })).body
    ).toEqual({ count: 1 })
    expect(await stateOf("l00001")).toBe("approved")
  })

  test("counts a listing named twice once, and answers 422 for no ids", async () => {
    expect(
      (await bulk({ ids: ["l0008d", "l0008d"], action: "approve" })).body
    ).toEqual({ count: 1 })
    expect((await bulk({ ids: [], action: "approve" })).status).toBe(422)
  })
})

describe("PATCH /admin/listings/:id", () => {
  const patch = (id: string, body: unknown) =>
    call("PATCH", `/admin/listings/${id}`, body)

  test("sets the sale state and audits the change", async () => {
    const res = await patch("l00001", { status: "sold" })
    expect(res.status).toBe(200)
    expect((await expectSchema(res, listingSchema)).status).toBe("sold")
    const [audit] = await db
      .select()
      .from(auditLog)
      .where(eq(auditLog.targetId, "l00001"))
    expect(audit).toMatchObject({
      action: "listing.update",
      before: { status: "available" },
      after: { status: "sold" },
    })
  })

  test("refuses the seller's text and price and a state change, naming each field", async () => {
    const res = await patch("l00001", {
      title: "A new title here",
      price: 5,
      moderation: "removed",
    })
    expect(res.status).toBe(422)
    expect((await errorOf(res)).fields).toEqual({
      title: "validation.not_editable",
      price: "validation.not_editable",
      moderation: "validation.not_editable",
    })
    expect(await stateOf("l00001")).toBe("approved")
    expect(await db.$count(auditLog)).toBe(0)
  })

  test("leaves the listing alone for an empty body, and answers 404 for an unknown one", async () => {
    expect((await patch("l00001", {})).status).toBe(200)
    expect(await db.$count(auditLog)).toBe(0)
    expect((await patch("nope", { status: "sold" })).status).toBe(404)
  })
})
