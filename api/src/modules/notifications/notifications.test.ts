import { beforeEach, describe, expect, test } from "bun:test"
import { countsSchema } from "@sayaratak/shared/schemas/api"
import { eq, isNull, sql } from "drizzle-orm"

import { db } from "~/shared/db/client"

import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { broadcasts, notifications } from "./notifications.tables"

const seeded = buildSeed()

beforeEach(resetDb)

describe("notification table", () => {
  test("holds every mock notification, read and unread", async () => {
    expect(await db.$count(notifications)).toBe(seeded.notifications.length)
    expect(await db.$count(notifications, isNull(notifications.readAt))).toBe(
      seeded.notifications.filter((n) => !n.readAt).length
    )
  })

  test("refuses a title missing a language", async () => {
    // Raw SQL: the column type would not let a one-language value through.
    const error = await db
      .execute(
        sql`update notifications set title = '{"ar": "x"}' where id = 'n-1'`
      )
      .catch((error) => error)
    expect(error.cause.constraint).toBe("notifications_title")
  })
})

describe("broadcast table", () => {
  const row = {
    id: "bc-1",
    title: { ar: "x", en: "x" },
    body: { ar: "x", en: "x" },
    roles: ["user" as const],
    verifiedOnly: false,
    status: "queued" as const,
    recipients: 0,
    createdAt: new Date(),
  }
  const refusal = (values: Partial<typeof broadcasts.$inferInsert>) =>
    db
      .insert(broadcasts)
      .values({ ...row, ...values })
      .catch((error) => error.cause.constraint)

  test("refuses a broadcast with no role in its audience", async () => {
    expect(await refusal({ roles: [] })).toBe("broadcasts_roles")
  })

  test("refuses a sent broadcast that has no finish time", async () => {
    expect(await refusal({ status: "sent" })).toBe("broadcasts_finished")
    await db
      .insert(broadcasts)
      .values({ ...row, status: "sent", finishedAt: new Date() })
  })
})

describe("GET /me/counts", () => {
  test("a non-admin gets only the unread counts", async () => {
    const { cookie } = await signIn("user")
    const res = await req("/me/counts", { headers: { cookie } })
    const counts = await expectSchema(res, countsSchema)
    expect(Object.keys(counts).sort()).toEqual([
      "unreadMessages",
      "unreadNotifications",
    ])
  })

  test("an admin also gets the queue sizes", async () => {
    const { cookie } = await signIn("admin")
    const counts = await expectSchema(
      await req("/me/counts", { headers: { cookie } }),
      countsSchema
    )
    expect(counts.pendingListings).toBeNumber()
    expect(counts.flaggedReviews).toBeNumber()
  })

  test("reading a notification lowers the count", async () => {
    const { cookie } = await signIn("user")
    const before = await expectSchema(
      await req("/me/counts", { headers: { cookie } }),
      countsSchema
    )
    await db
      .update(notifications)
      .set({ readAt: new Date() })
      .where(eq(notifications.userId, "u-omar"))
    const after = await expectSchema(
      await req("/me/counts", { headers: { cookie } }),
      countsSchema
    )
    expect(before.unreadNotifications).toBeGreaterThan(0)
    expect(after.unreadNotifications).toBe(0)
  })

  test("returns 401 signed out", async () => {
    expect((await req("/me/counts")).status).toBe(401)
  })
})
