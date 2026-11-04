import { beforeEach, describe, expect, test } from "bun:test"
import { okSchema } from "@sayaratak/shared/schemas/api"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { notificationSchema } from "@sayaratak/shared/schemas/messaging"
import { and, eq, isNull } from "drizzle-orm"

import { db } from "~/shared/db/client"

import {
  call,
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  type SignedIn,
  signIn,
} from "../../../tests/helpers"
import { notifications } from "./notifications.tables"

const pageSchema = pageOf(notificationSchema)
const list = async (as: SignedIn, query = "") =>
  expectSchema(
    await req(`/notifications${query}`, { headers: { cookie: as.cookie } }),
    pageSchema
  )
const unreadOf = (userId: string) =>
  db.$count(
    notifications,
    and(eq(notifications.userId, userId), isNull(notifications.readAt))
  )

beforeEach(resetDb)

describe("GET /notifications", () => {
  test("is 401 signed out and lists the account's own, newest first", async () => {
    expect((await req("/notifications")).status).toBe(401)
    const page = await list(await signIn("user"))
    expect(page.total).toBe(
      await db.$count(notifications, eq(notifications.userId, DEMO_IDS.user))
    )
    const times = page.items.map((n) => n.createdAt)
    expect(times).toEqual([...times].sort().reverse())
    expect(page).toMatchObject({ page: 1, pageSize: 20 })
  })

  test("`unread=true` keeps the unread ones", async () => {
    const page = await list(await signIn("user"), "?unread=true")
    expect(page.total).toBe(await unreadOf(DEMO_IDS.user))
    expect(page.items.every((n) => n.readAt === undefined)).toBe(true)
  })

  test("pages by number and back from a notification with `before`", async () => {
    const buyer = await signIn("user")
    const all = await list(buyer, "?pageSize=100")
    expect(all.items.length).toBeGreaterThan(3)
    const second = await list(buyer, "?page=2&pageSize=2")
    expect(second.items.map((n) => n.id)).toEqual(
      all.items.slice(2, 4).map((n) => n.id)
    )
    const older = await list(buyer, `?before=${all.items[1]?.id}&limit=2`)
    expect(older.items.map((n) => n.id)).toEqual(
      all.items.slice(2, 4).map((n) => n.id)
    )
    expect(older.total).toBe(all.total - 2)
    const none = await list(buyer, "?before=n-nope")
    expect(none.items).toEqual([])
  })

  test("does not start after another account's notification", async () => {
    const other = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.userId, DEMO_IDS.dealership))
      .limit(1)
    const page = await list(await signIn("user"), `?before=${other[0]?.id}`)
    expect(page.items).toEqual([])
  })
})

describe("POST /notifications/read", () => {
  test("marks the ones named and leaves the rest", async () => {
    const buyer = await signIn("user")
    const unread = (await list(buyer, "?unread=true")).items
    expect(unread.length).toBeGreaterThan(1)
    const res = await call(buyer, "/notifications/read", {
      method: "POST",
      body: { ids: [unread[0]?.id] },
    })
    await expectSchema(res, okSchema)
    expect(await unreadOf(DEMO_IDS.user)).toBe(unread.length - 1)
  })

  test("marks all when no ids are sent, and an empty list marks none", async () => {
    const buyer = await signIn("user")
    const before = await unreadOf(DEMO_IDS.user)
    await call(buyer, "/notifications/read", {
      method: "POST",
      body: { ids: [] },
    })
    expect(await unreadOf(DEMO_IDS.user)).toBe(before)
    await call(buyer, "/notifications/read", { method: "POST", body: {} })
    expect(await unreadOf(DEMO_IDS.user)).toBe(0)
  })

  test("never marks another account's notifications", async () => {
    const dealerUnread = await unreadOf(DEMO_IDS.dealership)
    await call(await signIn("user"), "/notifications/read", {
      method: "POST",
      body: {},
    })
    expect(await unreadOf(DEMO_IDS.dealership)).toBe(dealerUnread)
    expect((await req("/notifications/read", { method: "POST" })).status).toBe(
      401
    )
  })
})
