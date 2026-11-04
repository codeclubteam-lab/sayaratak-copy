import { beforeEach, describe, expect, test } from "bun:test"
import { adminReportSchema } from "@sayaratak/shared/schemas/admin"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { listings } from "~/modules/listings/listings.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import { expectSchema, resetDb } from "../../../tests/helpers"
import {
  auditOf,
  listingOf,
  note,
  removedNotices,
  reportOf,
} from "../../../tests/reports"

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})

const dismiss = (id: string, body: unknown = { note }) =>
  call("POST", `/admin/reports/${id}/dismiss`, body)
const act = (id: string, body: unknown = { note }) =>
  call("POST", `/admin/reports/${id}/action`, body)

describe("POST /admin/reports/:id/dismiss", () => {
  test("closes only that report with the note and writes the audit row", async () => {
    const res = await dismiss("rp-1")
    expect(res.status).toBe(200)
    expect(await expectSchema(res, adminReportSchema)).toMatchObject({
      id: "rp-1",
      status: "dismissed",
      resolutionNote: note,
      listingReports: 2,
    })
    expect((await reportOf("rp-2"))?.status).toBe("open")
    expect((await listingOf("l00001"))?.moderation).toBe("approved")
    expect((await auditOf("rp-1"))[0]).toMatchObject({
      action: "report.dismiss",
      targetType: "report",
      adminId: "u-admin",
      before: { status: "open" },
      after: { status: "dismissed" },
      reason: note,
    })
  })

  test("takes no note", async () => {
    expect((await dismiss("rp-3", {})).status).toBe(200)
    expect((await reportOf("rp-3"))?.resolutionNote).toBeNull()
  })

  test("answers 409 `conflict` for a closed report, 404 for an unknown one and 422 for a long note", async () => {
    for (const id of ["rp-5", "rp-6"]) {
      const res = await dismiss(id)
      expect(res.status).toBe(409)
      expect((await errorOf(res)).code).toBe("conflict")
    }
    expect((await reportOf("rp-5"))?.resolutionNote).not.toBe(note)
    expect((await dismiss("rp-9999")).status).toBe(404)
    expect((await dismiss("rp-3", { note: "x".repeat(301) })).status).toBe(422)
    expect((await reportOf("rp-3"))?.status).toBe("open")
  })
})

describe("POST /admin/reports/:id/action without a ban", () => {
  test("removes the listing, tells the owner once and closes every open report on it", async () => {
    const res = await act("rp-1")
    expect(res.status).toBe(200)
    expect(await expectSchema(res, adminReportSchema)).toMatchObject({
      id: "rp-1",
      status: "actioned",
      resolutionNote: note,
      listing: { id: "l00001", moderation: "removed" },
    })
    expect((await listingOf("l00001"))?.moderation).toBe("removed")
    for (const id of ["rp-1", "rp-2"])
      expect(await reportOf(id)).toMatchObject({
        status: "actioned",
        resolutionNote: note,
      })
    expect((await reportOf("rp-3"))?.status).toBe("open")
    const notices = await removedNotices("ud-2")
    expect(notices).toHaveLength(1)
    expect(notices[0]).toMatchObject({
      title: { ar: "تمت إزالة إعلانك", en: "Your listing was removed" },
    })
    expect((await auditOf("rp-1"))[0]).toMatchObject({
      action: "report.action",
      after: { status: "actioned", outcome: "removed", closed: 2 },
      reason: note,
    })
    expect((await auditOf("l00001"))[0]).toMatchObject({
      action: "listing.remove",
      before: { moderation: "approved" },
    })
  })

  test("a listing already removed only has its reports closed, with no second notice", async () => {
    await db
      .update(listings)
      .set({ moderation: "removed" })
      .where(eq(listings.id, "l00001"))
    const res = await act("rp-2")
    expect(res.status).toBe(200)
    expect((await reportOf("rp-1"))?.status).toBe("actioned")
    expect(await removedNotices("ud-2")).toHaveLength(0)
    expect((await auditOf("rp-2"))[0]?.after).toMatchObject({ outcome: "none" })
    expect(await auditOf("l00001")).toHaveLength(0)
  })

  test("a deleted listing only has its report closed", async () => {
    await db.delete(listings).where(eq(listings.id, "l0000f"))
    const before = (await removedNotices("u-omar")).length
    const res = await act("rp-3")
    expect(res.status).toBe(200)
    expect(await expectSchema(res, adminReportSchema)).toMatchObject({
      status: "actioned",
      listing: null,
    })
    expect(await removedNotices("u-omar")).toHaveLength(before)
  })

  test("answers 409 `conflict` for a closed report, 404 for an unknown one, and changes nothing", async () => {
    const res = await act("rp-6")
    expect(res.status).toBe(409)
    expect((await errorOf(res)).code).toBe("conflict")
    expect((await listingOf("l00010"))?.moderation).toBe("approved")
    expect((await act("rp-9999")).status).toBe(404)
  })

  test("two admins pressing Action together remove once and tell the owner once", async () => {
    const [a, b] = await Promise.all([act("rp-1"), act("rp-2")])
    expect([a.status, b.status].toSorted()).toEqual([200, 409])
    expect(await removedNotices("ud-2")).toHaveLength(1)
    expect(await auditOf("l00001")).toHaveLength(1)
  })
})
