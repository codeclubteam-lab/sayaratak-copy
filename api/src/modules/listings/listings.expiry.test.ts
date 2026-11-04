import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test"
import { and, eq, inArray } from "drizzle-orm"

import { notifications } from "~/modules/notifications/notifications.tables"
import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"

import { resetDb } from "../../../tests/helpers"
import { failOnCall } from "../../../tests/jobs"
import * as queries from "./listings.expiry.queries"
import { notifyExpired } from "./listings.expiry.service"
import { listings } from "./listings.tables"

const DAY_MS = 86_400_000
const now = () => new Date()

let ids: string[] = []

beforeEach(async () => {
  await resetDb()
  // Nothing has expired, then three approved, available listings to play with.
  await db.update(listings).set({
    expiresAt: new Date(Date.now() + 60 * DAY_MS),
    expiredNotifiedAt: null,
  })
  const picked = await db
    .select({ id: listings.id })
    .from(listings)
    .where(
      and(eq(listings.moderation, "approved"), eq(listings.status, "available"))
    )
    .limit(3)
  ids = picked.map((row) => row.id)
  if (ids.length < 3) throw new Error("the seed has approved listings")
})
afterEach(() => {
  spyOn(clock, "now").mockRestore()
})

const expire = (list: string[], at: Date) =>
  db.update(listings).set({ expiresAt: at }).where(inArray(listings.id, list))
const notices = () =>
  db
    .select()
    .from(notifications)
    .where(eq(notifications.type, "listing_expired"))
const yesterday = () => new Date(now().getTime() - DAY_MS)

describe("notifyExpired (listing-expiry job)", () => {
  test("tells the owner once, in both languages, with the listing's title", async () => {
    const [id] = ids
    if (!id) throw new Error("no listing")
    await expire([id], yesterday())

    expect(await notifyExpired()).toBe(1)

    const [row] = await db.select().from(listings).where(eq(listings.id, id))
    const [notice] = await notices()
    expect(notice).toMatchObject({
      userId: row?.ownerUserId,
      type: "listing_expired",
      title: { ar: "انتهت مدة إعلانك", en: "Your listing expired" },
      body: { ar: row?.title, en: row?.title },
    })
    expect(row?.expiredNotifiedAt).toBeInstanceOf(Date)
  })

  test("says nothing about a listing that is not shown or is not for sale any more", async () => {
    const [shown, sold, pending] = ids
    if (!shown || !sold || !pending) throw new Error("no listings")
    await db
      .update(listings)
      .set({ status: "sold" })
      .where(eq(listings.id, sold))
    await db
      .update(listings)
      .set({ moderation: "pending" })
      .where(eq(listings.id, pending))
    await expire(ids, yesterday())

    expect(await notifyExpired()).toBe(1)
    const [row] = await db.select().from(listings).where(eq(listings.id, shown))
    expect(row?.ownerUserId).toBe((await notices())[0]?.userId ?? null)
  })

  test("running it twice tells each owner once", async () => {
    await expire(ids, yesterday())
    expect(await notifyExpired()).toBe(3)
    expect(await notifyExpired()).toBe(0)
    expect(await notices()).toHaveLength(3)
  })

  test("a listing that was renewed and expires again is told again", async () => {
    const [id] = ids
    if (!id) throw new Error("no listing")
    await expire([id], yesterday())
    await notifyExpired()

    // Renewed for a month, then that month passes.
    await expire([id], new Date(Date.now() + 30 * DAY_MS))
    expect(await notifyExpired()).toBe(0)
    spyOn(clock, "now").mockReturnValue(new Date(Date.now() + 31 * DAY_MS))
    expect(await notifyExpired()).toBe(1)
    expect(await notices()).toHaveLength(2)
  })

  test("a crash after the first batch is finished by the next run", async () => {
    await expire(ids, yesterday())
    const crash = failOnCall(queries, "lockExpiredUnnotified", 2)

    await expect(notifyExpired(2)).rejects.toThrow("crashed")
    expect(await notices()).toHaveLength(2)

    crash.mockRestore()
    expect(await notifyExpired(2)).toBe(1)
    expect(await notices()).toHaveLength(3)
  })
})
