import { beforeEach, describe, expect, test } from "bun:test"
import { adminBusinessSchema } from "@sayaratak/shared/schemas/admin"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import { and, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { notifications } from "~/modules/notifications/notifications.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { buildSeed, expectSchema, req, resetDb } from "../../../tests/helpers"

// Seed: d-1 is the verified dealership of u-dealer (Growth plan, 80 listings), d-2 a verified one
// of ud-1 with no subscription, d-12 a suspended one of ud-11, w-1 the workshop of u-workshop
// (Plus) and m-1 the mechanic of u-mechanic (Basic).
const seeded = buildSeed()
const dealerListing = seeded.listings.find(
  (l) =>
    l.ownerUserId === "u-dealer" &&
    l.moderation === "approved" &&
    l.status === "available"
)

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const patch = (id: string, body: unknown) =>
  call("PATCH", `/admin/businesses/${id}`, body)
const auditOf = (id: string) =>
  db.select().from(auditLog).where(eq(auditLog.targetId, id))
const noticesTo = (userId: string, type: string) =>
  db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.type, type as "business_status")
      )
    )

describe("PATCH /admin/businesses/:id verified", () => {
  test("takes the badge away, tells the owner and writes the audit row", async () => {
    const before = (await noticesTo("u-dealer", "verification_result")).length
    const res = await patch("d-1", { verified: false })
    expect(res.status).toBe(200)
    expect(await expectSchema(res, adminBusinessSchema)).toMatchObject({
      id: "d-1",
      verified: false,
    })
    const notices = await noticesTo("u-dealer", "verification_result")
    expect(notices).toHaveLength(before + 1)
    const notice = notices.find((n) => n.title.en.includes("removed"))
    expect(notice?.title).toEqual({
      ar: "أُزيلت شارة التوثيق",
      en: "Your verified badge was removed",
    })
    expect(notice?.href).toBe("/dealer/verification")
    expect(await auditOf("d-1")).toMatchObject([
      {
        action: "business.unverify",
        targetType: "business",
        adminId: "u-admin",
        before: { verified: true },
        after: { verified: false },
      },
    ])
  })

  test("a dealership's listings follow the badge", async () => {
    const shows = async () =>
      expectSchema(
        await req(`/listings/${dealerListing?.id}`),
        listingSchema
      ).then((listing) => listing.owner.verified)
    expect(await shows()).toBe(true)
    await patch("d-1", { verified: false })
    expect(await shows()).toBe(false)
    await patch("d-1", { verified: true })
    expect(await shows()).toBe(true)
  })

  test("giving the badge is silent; a value already set changes nothing", async () => {
    const before = (await noticesTo("ud-8", "verification_result")).length
    expect((await patch("d-9", { verified: true })).status).toBe(200)
    expect(await noticesTo("ud-8", "verification_result")).toHaveLength(before)
    expect(await auditOf("d-9")).toMatchObject([
      { action: "business.verify", before: { verified: false } },
    ])
    expect((await patch("d-9", { verified: true })).status).toBe(200)
    expect(await auditOf("d-9")).toHaveLength(1)
    expect((await patch("d-9", {})).status).toBe(200)
    expect(await auditOf("d-9")).toHaveLength(1)
  })
})

describe("PATCH /admin/businesses/:id status", () => {
  test("suspends with a reason, tells the owner, then restores", async () => {
    const res = await patch("w-1", { status: "suspended", reason: "Fake" })
    expect(res.status).toBe(200)
    expect(await expectSchema(res, adminBusinessSchema)).toMatchObject({
      status: "suspended",
      suspendedReason: "Fake",
    })
    const [notice] = await noticesTo("u-workshop", "business_status")
    expect(notice).toMatchObject({
      title: { ar: "تم إيقاف صفحتك", en: "Your page is suspended" },
      body: { ar: "Fake", en: "Fake" },
      href: "/workshop",
    })
    const back = await expectSchema(
      await patch("w-1", { status: "active" }),
      adminBusinessSchema
    )
    expect(back.status).toBe("active")
    expect(back.suspendedReason).toBeUndefined()
    expect(await noticesTo("u-workshop", "business_status")).toHaveLength(2)
    expect((await auditOf("w-1")).map((row) => row.action).sort()).toEqual([
      "business.restore",
      "business.suspend",
    ])
  })

  test("a suspension needs a reason (422) and changes nothing without it", async () => {
    const res = await patch("m-1", { status: "suspended" })
    expect(res.status).toBe(422)
    expect(await errorOf(res)).toEqual({
      code: "validation",
      fields: { reason: "validation.required" },
    })
    const found = await call("GET", "/admin/businesses?id=m-1")
    const { items } = (await found.json()) as { items: { status: string }[] }
    expect(items[0]?.status).toBe("active")
    expect(await auditOf("m-1")).toHaveLength(0)
  })

  test("a refused suspension also drops the badge change sent with it", async () => {
    const before = (await noticesTo("u-dealer", "verification_result")).length
    const res = await patch("d-1", { verified: false, status: "suspended" })
    expect(res.status).toBe(422)
    expect(await auditOf("d-1")).toHaveLength(0)
    expect(await noticesTo("u-dealer", "verification_result")).toHaveLength(
      before
    )
  })

  test("suspending or restoring again changes nothing", async () => {
    await patch("d-12", { status: "active" })
    expect(await auditOf("d-12")).toHaveLength(1)
    await patch("d-12", { status: "active" })
    expect(await auditOf("d-12")).toHaveLength(1)
    const before = (await noticesTo("u-dealer", "business_status")).length
    await patch("d-1", { status: "suspended", reason: "x" })
    await patch("d-1", { status: "suspended", reason: "y" })
    expect(await auditOf("d-1")).toHaveLength(1)
    expect(await noticesTo("u-dealer", "business_status")).toHaveLength(
      before + 1
    )
  })

  test("answers 404 for an unknown business and 422 for a bad body", async () => {
    expect((await patch("nope", { verified: true })).status).toBe(404)
    expect((await patch("d-1", { status: "gone" })).status).toBe(422)
    expect((await patch("d-1", { reason: "" })).status).toBe(422)
  })
})
