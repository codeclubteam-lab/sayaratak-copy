import { eq } from "drizzle-orm"
import { beforeEach, describe, expect, test } from "bun:test"
import { campaignSchema } from "@sayaratak/shared/schemas/ads"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { campaigns } from "~/modules/ads/ads.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, resetDb } from "../../../tests/helpers"
import {
  campaignReceipt,
  noticesTo,
  rowOf,
} from "../admin-payments/admin-payments.test-helpers"

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const approve = (id: string) => call("POST", `/admin/campaigns/${id}/approve`)
const reject = (id: string, body: unknown = { reason: "Blurry image" }) =>
  call("POST", `/admin/campaigns/${id}/reject`, body)
// The seed already has payment notices; the campaign decisions add ones about the "banner campaign".
const bannerNotices = async (type: "payment_approved" | "payment_rejected") =>
  (await noticesTo("u-workshop", type)).filter((row) =>
    row.title.en.includes("banner campaign")
  )
const campaignOf = (id: string) =>
  db
    .select()
    .from(campaigns)
    .where(eq(campaigns.id, id))
    .then(([row]) => row)
const auditOf = (id: string) =>
  db.select().from(auditLog).where(eq(auditLog.targetId, id))

describe("POST /admin/campaigns/:id/approve", () => {
  test("approves the campaign and its receipt together, tells the advertiser and writes both audit rows", async () => {
    const receipt = await campaignReceipt()
    const res = await approve("camp-2")
    expect(res.status).toBe(200)
    expect(await expectSchema(res, campaignSchema)).toMatchObject({
      id: "camp-2",
      status: "approved",
    })
    expect(await rowOf(receipt)).toMatchObject({
      status: "approved",
      reviewedBy: "u-admin",
    })
    expect(await bannerNotices("payment_approved")).toMatchObject([
      {
        title: { en: "Your banner campaign is approved" },
        href: "/ads",
      },
    ])
    expect(await auditOf("camp-2")).toMatchObject([
      {
        action: "campaign.approve",
        adminId: "u-admin",
        before: { status: "under_review" },
        after: { status: "approved" },
      },
    ])
    expect(await auditOf(receipt)).toMatchObject([
      { action: "payment.approve" },
    ])
  })

  test("approves a campaign that has no receipt", async () => {
    expect((await approve("camp-2")).status).toBe(200)
    expect((await campaignOf("camp-2"))?.status).toBe("approved")
  })

  test("answers 409 `exists` for a campaign already decided and 404 for an unknown one", async () => {
    const done = await approve("camp-1")
    expect(done.status).toBe(409)
    expect((await errorOf(done)).code).toBe("exists")
    expect((await approve("nope")).status).toBe(404)
    expect(await auditOf("camp-1")).toEqual([])
  })

  test("two admins pressing Approve together approve it once and tell the advertiser once", async () => {
    await campaignReceipt()
    const results = await Promise.all([approve("camp-2"), approve("camp-2")])
    expect(results.map((res) => res.status).sort()).toEqual([200, 409])
    expect(await bannerNotices("payment_approved")).toHaveLength(1)
    expect(await auditOf("camp-2")).toHaveLength(1)
  })
})

describe("POST /admin/campaigns/:id/reject", () => {
  test("rejects the campaign and its receipt with the reason, tells the advertiser and writes both audit rows", async () => {
    const receipt = await campaignReceipt()
    const res = await reject("camp-2")
    expect(res.status).toBe(200)
    expect(await expectSchema(res, campaignSchema)).toMatchObject({
      status: "rejected",
      rejectionReason: "Blurry image",
    })
    expect(await rowOf(receipt)).toMatchObject({
      status: "rejected",
      rejectionReason: "Blurry image",
    })
    expect(await bannerNotices("payment_rejected")).toMatchObject([
      {
        title: { en: "Your banner campaign was rejected" },
        body: { ar: "Blurry image", en: "Blurry image" },
        href: "/ads",
      },
    ])
    expect(await auditOf("camp-2")).toMatchObject([
      { action: "campaign.reject", reason: "Blurry image" },
    ])
  })

  test("needs a reason (422), and a campaign already decided answers 409 `exists`", async () => {
    for (const body of [{}, { reason: "" }]) {
      const res = await reject("camp-2", body)
      expect(res.status).toBe(422)
      expect((await errorOf(res)).fields).toEqual({
        reason: "validation.required",
      })
    }
    expect((await campaignOf("camp-2"))?.status).toBe("under_review")
    const done = await reject("camp-1")
    expect(done.status).toBe(409)
    expect((await errorOf(done)).code).toBe("exists")
    expect((await reject("nope")).status).toBe(404)
    expect(await bannerNotices("payment_rejected")).toEqual([])
  })
})
