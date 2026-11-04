import { beforeEach, describe, expect, test } from "bun:test"
import { adminReportSchema } from "@sayaratak/shared/schemas/admin"
import { and, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { session, user } from "~/modules/auth/auth.tables"
import { listings } from "~/modules/listings/listings.tables"

import { adminCaller } from "../../../tests/admin"
import { expectSchema, resetDb, signIn } from "../../../tests/helpers"
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

const act = (id: string, body: unknown = { note }) =>
  call("POST", `/admin/reports/${id}/action`, body)

describe("POST /admin/reports/:id/action with a ban", () => {
  const ban = { reason: "Fake photos", duration: "7d" }

  test("bans the seller, ends their sessions, keeps the listing and tells nobody", async () => {
    await signIn("dealership")
    const res = await act("rp-1", { note, ban })
    expect(res.status).toBe(200)
    expect(await expectSchema(res, adminReportSchema)).toMatchObject({
      status: "actioned",
      sellerBanned: true,
      listing: { id: "l00001", moderation: "approved" },
    })
    expect(await reportOf("rp-2")).toMatchObject({ status: "actioned" })
    expect(
      await db
        .select()
        .from(user)
        .where(eq(user.id, "ud-2"))
        .then(([row]) => row)
    ).toMatchObject({ banned: true, banReason: ban.reason })
    expect(await removedNotices("ud-2")).toHaveLength(0)
    expect((await listingOf("l00001"))?.moderation).toBe("approved")
    expect(await auditOf("ud-2")).toMatchObject([{ action: "user.ban" }])
    expect((await auditOf("rp-1"))[0]?.after).toMatchObject({
      outcome: "banned",
      closed: 2,
    })
  })

  test("a seller who is an admin cannot be banned and the report stays open", async () => {
    await db
      .update(listings)
      .set({ ownerUserId: "u-admin" })
      .where(eq(listings.id, "l0000f"))
    const res = await act("rp-3", { note, ban })
    expect(res.status).toBe(403)
    expect((await reportOf("rp-3"))?.status).toBe("open")
  })

  test("a deleted listing cannot be banned through: 404, report stays open", async () => {
    await db.delete(listings).where(eq(listings.id, "l0000f"))
    expect((await act("rp-3", { note, ban })).status).toBe(404)
    expect((await reportOf("rp-3"))?.status).toBe("open")
  })

  test("a closed report answers 409 and bans nobody", async () => {
    const res = await act("rp-6", { note, ban })
    expect(res.status).toBe(409)
    expect(
      await db.$count(user, and(eq(user.banned, true), eq(user.id, "u-49")))
    ).toBe(0)
    expect(await db.$count(session, eq(session.userId, "u-49"))).toBe(0)
  })

  test("a ban without a reason is 422", async () => {
    expect((await act("rp-1", { note, ban: { duration: "7d" } })).status).toBe(
      422
    )
    expect((await reportOf("rp-1"))?.status).toBe("open")
  })
})
