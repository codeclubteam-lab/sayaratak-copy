import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test"
import { userSchema } from "@sayaratak/shared/schemas/user"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { auditLog } from "~/modules/audit/audit.tables"
import { session, user } from "~/modules/auth/auth.tables"

import { adminCaller, errorOf } from "../../../tests/admin"
import {
  authPost,
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"

const DAY_MS = 86_400_000
const reason = "Repeated spam listings"

let call = adminCaller()
beforeEach(async () => {
  await resetDb()
  call = adminCaller()
})
afterEach(() => mock.restore())

const ban = (id: string, body: unknown = { reason, duration: "7d" }) =>
  call("POST", `/admin/users/${id}/ban`, body)
const rowOf = (id: string) =>
  db
    .select()
    .from(user)
    .where(eq(user.id, id))
    .then(([row]) => row)
const auditOf = (id: string) =>
  db.select().from(auditLog).where(eq(auditLog.targetId, id))

describe("POST /admin/users/:id/ban", () => {
  test("bans for 7 days, ends the sessions and writes the audit row", async () => {
    const { cookie } = await signIn("user")
    const res = await ban("u-omar")
    expect(res.status).toBe(200)
    const body = await expectSchema(res, userSchema)
    expect(body).toMatchObject({
      id: "u-omar",
      banned: true,
      bannedReason: reason,
    })
    const until = Date.parse(body.bannedUntil ?? "")
    expect(Math.abs(until - (Date.now() + 7 * DAY_MS))).toBeLessThan(60_000)
    expect(await db.$count(session, eq(session.userId, "u-omar"))).toBe(0)
    // `GET /me` answers null for a visitor with no live session.
    expect(await (await req("/me", { headers: { cookie } })).json()).toBeNull()
    expect((await auditOf("u-omar"))[0]).toMatchObject({
      action: "user.ban",
      adminId: "u-admin",
      reason,
      before: { banned: false },
      after: { banned: true, banReason: reason },
    })
  })

  test("bans for 30 days or for good", async () => {
    const month = await expectSchema(
      await ban("u-omar", { reason, duration: "30d" }),
      userSchema
    )
    const until = Date.parse(month.bannedUntil ?? "")
    expect(Math.abs(until - (Date.now() + 30 * DAY_MS))).toBeLessThan(60_000)
    const forever = await expectSchema(
      await ban("u-dealer", { reason, duration: "permanent" }),
      userSchema
    )
    expect(forever.banned).toBe(true)
    expect(forever.bannedUntil).toBeUndefined()
  })

  test("can be repeated to change the reason and the end", async () => {
    await ban("u-omar")
    const again = await expectSchema(
      await ban("u-omar", { reason: "Scam", duration: "permanent" }),
      userSchema
    )
    expect(again).toMatchObject({ bannedReason: "Scam" })
    expect(again.bannedUntil).toBeUndefined()
    expect(await auditOf("u-omar")).toHaveLength(2)
  })

  test("a banned person cannot sign in and their listings leave the public site", async () => {
    const dealerListing = buildSeed().listings.find(
      (l) => l.ownerUserId === "u-dealer" && l.moderation === "approved"
    )
    expect((await req(`/listings/${dealerListing?.slug}`)).status).toBe(200)
    await ban("u-dealer")
    expect((await req(`/listings/${dealerListing?.slug}`)).status).toBe(404)
    const attempt = await authPost("/sign-in/email", {
      email: "dealer@demo.sy",
      password: "Demo1234",
    })
    expect(attempt.status).toBe(403)
  })

  test("refuses an admin with 403 and an unknown account with 404, changing nothing", async () => {
    const admin = await ban("u-admin")
    expect(admin.status).toBe(403)
    expect(await errorOf(admin)).toMatchObject({ code: "forbidden" })
    expect((await rowOf("u-admin"))?.banned).toBe(false)
    expect((await ban("u-nobody")).status).toBe(404)
    expect(await db.$count(auditLog)).toBe(0)
  })

  test("needs a reason and a known duration", async () => {
    for (const body of [
      {},
      { duration: "7d" },
      { reason: "  ", duration: "7d" },
      { reason, duration: "1y" },
    ]) {
      const res = await ban("u-omar", body)
      expect(res.status).toBe(422)
    }
    expect((await rowOf("u-omar"))?.banned).toBe(false)
  })
})

describe("POST /admin/users/:id/unban", () => {
  test("lifts the ban, clears the reason and writes the audit row", async () => {
    await ban("u-omar")
    const res = await call("POST", "/admin/users/u-omar/unban")
    expect(res.status).toBe(200)
    const body = await expectSchema(res, userSchema)
    expect(body.banned).toBe(false)
    expect(body.bannedReason).toBeUndefined()
    expect(body.bannedUntil).toBeUndefined()
    expect((await auditOf("u-omar")).map((a) => a.action).sort()).toEqual([
      "user.ban",
      "user.unban",
    ])
    expect((await signIn("user")).cookie).toBeTruthy()
  })

  test("leaves an account that is not banned alone, with no audit row", async () => {
    const res = await call("POST", "/admin/users/u-omar/unban")
    expect(res.status).toBe(200)
    expect((await expectSchema(res, userSchema)).banned).toBe(false)
    expect(await db.$count(auditLog)).toBe(0)
  })

  test("answers 403 for an admin and 404 for an unknown account", async () => {
    expect((await call("POST", "/admin/users/u-admin/unban")).status).toBe(403)
    expect((await call("POST", "/admin/users/u-nobody/unban")).status).toBe(404)
  })
})
