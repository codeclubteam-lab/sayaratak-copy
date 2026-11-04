import { afterEach, beforeEach, describe, expect, test } from "bun:test"
import { desc, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { transaction } from "~/shared/db/tx"
import { outbox } from "~/shared/mail/outbox.tables"
import { flushPush, testBroken, testDead, testPushes } from "~/shared/push/send"
import { user } from "~/modules/auth/auth.tables"
import { notify } from "~/modules/notifications/notifications.service"
import { notifications } from "~/modules/notifications/notifications.tables"

import { DEMO_IDS, resetDb } from "../../../tests/helpers"
import { deliverPush } from "./devices.push.service"
import { devices } from "./devices.tables"

const message = {
  userId: DEMO_IDS.workshop,
  type: "review_new",
  title: { ar: "تقييم جديد", en: "New review" },
  body: { ar: "حصلت على 5 نجوم.", en: "You received 5 stars." },
  href: "/reviews",
} as const
const phone = (
  id: string,
  locale: "ar" | "en",
  userId = DEMO_IDS.workshop
) => ({
  id,
  userId,
  platform: "android" as const,
  fcmToken: `token-${id}`,
  appVersion: "1.0.0",
  locale,
  lastSeenAt: new Date(),
  createdAt: new Date(),
})
const pushRows = () =>
  db.select().from(outbox).where(eq(outbox.channel, "push")).orderBy(outbox.id)

beforeEach(async () => {
  await resetDb()
  testPushes.length = 0
  testDead.clear()
  testBroken.clear()
})
afterEach(flushPush)

describe("notify with devices", () => {
  test("pushes to each device in its own language, with the type, path and id", async () => {
    await db.insert(devices).values([phone("d1", "ar"), phone("d2", "en")])
    await notify(db, message)
    await flushPush()
    const [stored] = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, DEMO_IDS.workshop))
      .orderBy(desc(notifications.createdAt))
      .limit(1)
    const byToken = new Map(testPushes.map((push) => [push.token, push]))
    const data = {
      type: "review_new",
      id: stored?.id ?? "",
      href: "/workshop/reviews",
    }
    expect(byToken.get("token-d1")).toEqual({
      token: "token-d1",
      title: "تقييم جديد",
      body: "حصلت على 5 نجوم.",
      data,
    })
    expect(byToken.get("token-d2")).toEqual({
      token: "token-d2",
      title: "New review",
      body: "You received 5 stars.",
      data,
    })
  })

  test("closes each row once sent and drops what it showed", async () => {
    await db.insert(devices).values(phone("d1", "en"))
    await notify(db, message)
    await flushPush()
    const [row] = await pushRows()
    expect(row).toMatchObject({
      to: "d1",
      template: "review_new",
      locale: "en",
      payload: {},
      attempts: 0,
    })
    expect(row?.sentAt).not.toBeNull()
  })

  test("sends nothing when the person switched that kind off, and to a person with no device", async () => {
    await db.insert(devices).values(phone("d1", "en"))
    const prefs = {
      messages: true,
      updates: true,
      savedSearchMatches: true,
      reviews: false,
      billing: true,
      announcements: true,
    }
    await db.update(user).set({ prefs }).where(eq(user.id, DEMO_IDS.workshop))
    await notify(db, message)
    await notify(db, { ...message, userId: DEMO_IDS.user })
    await flushPush()
    expect(testPushes).toHaveLength(0)
    expect(await pushRows()).toHaveLength(0)
  })

  test("waits for the commit: a rolled-back transaction sends and keeps nothing", async () => {
    await db.insert(devices).values(phone("d1", "en"))
    await transaction(async (tx) => {
      await notify(tx, message)
      throw new Error("rollback")
    }).catch(() => undefined)
    await flushPush()
    expect(testPushes).toHaveLength(0)
    expect(await pushRows()).toHaveLength(0)
  })

  test("sends after a committed transaction", async () => {
    await db.insert(devices).values(phone("d1", "en"))
    await transaction((tx) => notify(tx, message))
    await flushPush()
    expect(testPushes).toHaveLength(1)
  })
})

describe("deliverPush", () => {
  test("deletes a device FCM calls dead, and closes the row", async () => {
    await db.insert(devices).values([phone("d1", "en"), phone("d2", "en")])
    testDead.add("token-d1")
    await notify(db, message)
    await flushPush()
    expect((await db.select().from(devices)).map((d) => d.id)).toEqual(["d2"])
    expect((await pushRows()).every((row) => row.sentAt)).toBe(true)
  })

  test("keeps a failed push in the outbox with backoff, then sends it when it can", async () => {
    await db.insert(devices).values(phone("d1", "en"))
    testBroken.add("token-d1")
    await notify(db, message)
    await flushPush()
    const [failed] = await pushRows()
    expect(failed).toMatchObject({ attempts: 1, sentAt: null })
    expect(failed?.lastError).toContain("fcm_send_503")
    expect(failed?.sendAfter.getTime()).toBeGreaterThan(Date.now())
    expect(failed?.payload.push?.title).toBe("New review")
    expect(await db.$count(devices)).toBe(1)

    testBroken.clear()
    if (failed) await deliverPush(failed)
    expect(testPushes).toHaveLength(1)
    const [sent] = await pushRows()
    expect(sent?.sentAt).not.toBeNull()
    expect(sent?.payload).toEqual({})
  })

  test("sends nothing for a phone that signed out or moved to another account since", async () => {
    await db.insert(devices).values([phone("d1", "en"), phone("d2", "en")])
    await notify(db, message)
    await flushPush()
    testPushes.length = 0
    // Rewind both rows to unsent, as if the first try had failed.
    await db.update(outbox).set({ sentAt: null })
    await db.delete(devices).where(eq(devices.id, "d1"))
    await db
      .update(devices)
      .set({ userId: DEMO_IDS.user })
      .where(eq(devices.id, "d2"))
    for (const row of await pushRows()) await deliverPush(row)
    expect(testPushes).toHaveLength(0)
    expect((await pushRows()).every((row) => row.sentAt)).toBe(true)
  })
})
