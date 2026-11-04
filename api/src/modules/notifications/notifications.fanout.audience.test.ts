import { beforeEach, describe, expect, test } from "bun:test"
import { eq, inArray, sql } from "drizzle-orm"

import { user } from "~/modules/auth/auth.tables"
import { devices } from "~/modules/devices/devices.tables"
import { db } from "~/shared/db/client"
import { outbox } from "~/shared/mail/outbox.tables"
import { testPushes } from "~/shared/push/send"

import { bellsOf, queueBroadcast } from "../../../tests/broadcasts"
import { DEMO_IDS, resetDb } from "../../../tests/helpers"
import { fanOut } from "./notifications.fanout.service"

// Seed: 61 individuals (2 banned, so 59 read announcements), 12 dealerships, 14 workshops, 18 mechanics.
beforeEach(async () => {
  await resetDb()
  testPushes.length = 0
})

describe("fanOut: who is reached and what is queued", () => {
  test("reaches only accounts that existed when it was sent", async () => {
    const sent = await queueBroadcast({
      createdAt: new Date(Date.now() - 60_000),
    })
    // Two people sign up after Send.
    await db
      .update(user)
      .set({ createdAt: new Date() })
      .where(inArray(user.id, [DEMO_IDS.user, "u-5"]))

    expect(await fanOut()).toBe(57)
    const ids = (await bellsOf(sent.title)).map((bell) => bell.userId)
    expect(ids).not.toContain(DEMO_IDS.user)
    expect(ids).not.toContain("u-5")
  })

  test("leaves out banned accounts and those that switched announcements off", async () => {
    const sent = await queueBroadcast({ roles: ["dealership"] })
    await db
      .update(user)
      .set({ prefs: sql`jsonb_set(${user.prefs}, '{announcements}', 'false')` })
      .where(eq(user.id, "ud-2"))
    await fanOut()
    const ids = (await bellsOf(sent.title)).map((bell) => bell.userId)
    expect(ids).toHaveLength(11)
    expect(ids).not.toContain("ud-2")
  })

  test("a link opens the recipient's own page", async () => {
    const sent = await queueBroadcast({
      roles: ["user", "dealership"],
      href: "/listings",
    })
    await fanOut()
    const byUser = new Map(
      (await bellsOf(sent.title)).map((bell) => [bell.userId, bell.href])
    )
    expect(byUser.get(DEMO_IDS.dealership)).toBe("/dealer/inventory")
    expect(byUser.get(DEMO_IDS.user)).toBe("/account/listings")
  })

  test("queues a push per device in the device's language, without sending it from the job", async () => {
    const now = new Date()
    await db.insert(devices).values([
      {
        id: "dev-a",
        userId: DEMO_IDS.dealership,
        platform: "android",
        fcmToken: "token-a",
        appVersion: "1.0.0",
        locale: "en",
        lastSeenAt: now,
        createdAt: now,
      },
      {
        id: "dev-b",
        userId: DEMO_IDS.dealership,
        platform: "ios",
        fcmToken: "token-b",
        appVersion: "1.0.0",
        locale: "ar",
        lastSeenAt: now,
        createdAt: now,
      },
    ])
    const sent = await queueBroadcast({
      roles: ["dealership"],
      href: "/search",
    })

    await fanOut()

    const rows = await db
      .select()
      .from(outbox)
      .where(eq(outbox.channel, "push"))
    expect(rows.map((row) => row.to).sort()).toEqual(["dev-a", "dev-b"])
    const english = rows.find((row) => row.to === "dev-a")
    expect(english).toMatchObject({
      template: "broadcast",
      sentAt: null,
      payload: { push: { userId: DEMO_IDS.dealership, title: sent.title.en } },
    })
    expect(rows.find((row) => row.to === "dev-b")?.payload.push?.title).toBe(
      sent.title.ar
    )
    expect(english?.payload.push?.data).toMatchObject({
      type: "broadcast",
      href: "/search",
    })
    expect(testPushes).toEqual([])
  })
})
