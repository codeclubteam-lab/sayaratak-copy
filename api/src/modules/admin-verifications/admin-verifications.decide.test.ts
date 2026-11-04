import { beforeEach, describe, expect, test } from "bun:test"
import { adminVerificationSchema } from "@sayaratak/shared/schemas/admin"
import { and, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { dealerships } from "~/modules/businesses/businesses.tables"
import { notifications } from "~/modules/notifications/notifications.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, resetDb } from "../../../tests/helpers"

// Seed: vr-1 is the pending request of d-9 (owner ud-8), vr-3 of the mechanic m-12 (um-11),
// vr-5 an approved one and vr-6 a rejected one.
let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const decide = (id: string, action: string, body?: unknown) =>
  call("POST", `/admin/verifications/${id}/${action}`, body)
const noticesTo = (userId: string) =>
  db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.type, "verification_result")
      )
    )
const auditOf = (id: string) =>
  db.select().from(auditLog).where(eq(auditLog.targetId, id))
const verifiedD9 = () =>
  db
    .select({ verified: dealerships.verified })
    .from(dealerships)
    .where(eq(dealerships.id, "d-9"))
    .then(([row]) => row?.verified)

describe("POST /admin/verifications/:id/approve", () => {
  test("gives the badge, tells the owner and writes the audit row", async () => {
    expect(await verifiedD9()).toBe(false)
    const before = (await noticesTo("ud-8")).length
    const res = await decide("vr-1", "approve")
    expect(res.status).toBe(200)
    expect(await expectSchema(res, adminVerificationSchema)).toMatchObject({
      id: "vr-1",
      status: "approved",
    })
    expect(await verifiedD9()).toBe(true)
    const notices = await noticesTo("ud-8")
    expect(notices).toHaveLength(before + 1)
    expect(
      notices.find((n) => n.title.en === "You are verified")
    ).toMatchObject({ href: "/dealer/verification" })
    expect(await auditOf("vr-1")).toMatchObject([
      {
        action: "verification.approve",
        targetType: "verification",
        adminId: "u-admin",
        before: { status: "pending" },
        after: { status: "approved" },
      },
    ])
  })

  test("answers 409 `conflict` for a decided request and 404 for an unknown one", async () => {
    for (const id of ["vr-5", "vr-6"]) {
      const res = await decide(id, "approve")
      expect(res.status).toBe(409)
      expect((await errorOf(res)).code).toBe("conflict")
    }
    expect((await decide("nope", "approve")).status).toBe(404)
    expect(await auditOf("vr-5")).toHaveLength(0)
  })

  test("two admins approving together give one 200, one 409 and one notice", async () => {
    const other = adminCaller()
    const before = (await noticesTo("um-11")).length
    const both = await Promise.all([
      decide("vr-3", "approve"),
      other("POST", "/admin/verifications/vr-3/approve"),
    ])
    expect(both.map((r) => r.status).sort()).toEqual([200, 409])
    expect(await noticesTo("um-11")).toHaveLength(before + 1)
    expect(await auditOf("vr-3")).toHaveLength(1)
  })
})

describe("POST /admin/verifications/:id/reject", () => {
  test("keeps the badge off, stores the reason and tells the owner", async () => {
    const before = (await noticesTo("ud-8")).length
    const res = await decide("vr-1", "reject", { reason: "Blurry photos" })
    expect(res.status).toBe(200)
    expect(await expectSchema(res, adminVerificationSchema)).toMatchObject({
      status: "rejected",
      rejectionReason: "Blurry photos",
    })
    expect(await verifiedD9()).toBe(false)
    const notices = await noticesTo("ud-8")
    expect(notices).toHaveLength(before + 1)
    expect(
      notices.find((n) => n.title.en === "Verification was declined")
    ).toMatchObject({ body: { ar: "Blurry photos", en: "Blurry photos" } })
    expect(await auditOf("vr-1")).toMatchObject([
      { action: "verification.reject", reason: "Blurry photos" },
    ])
  })

  test("needs a reason and a pending request", async () => {
    expect((await decide("vr-1", "reject", {})).status).toBe(422)
    expect((await decide("vr-1", "reject", { reason: "  " })).status).toBe(422)
    expect((await decide("vr-5", "reject", { reason: "x" })).status).toBe(409)
    expect((await decide("nope", "reject", { reason: "x" })).status).toBe(404)
    expect(await auditOf("vr-1")).toHaveLength(0)
  })
})
