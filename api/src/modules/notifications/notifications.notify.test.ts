import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { user } from "~/modules/auth/auth.tables"
import { db } from "~/shared/db/client"

import { DEMO_IDS, resetDb } from "../../../tests/helpers"
import { toNotificationHref } from "./notifications.mapper"
import { notify } from "./notifications.service"
import { notifications } from "./notifications.tables"

const message = {
  userId: DEMO_IDS.workshop,
  type: "review_new",
  title: { ar: "تقييم جديد", en: "New review" },
  body: { ar: "حصلت على 5 نجوم.", en: "You received 5 stars." },
  href: "/reviews",
} as const
const lastOf = (userId: string) =>
  db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(notifications.createdAt)
    .then((rows) => rows.at(-1))

beforeEach(resetDb)

describe("notify", () => {
  test("stores both languages and the recipient's own path", async () => {
    await notify(db, message)
    expect(await lastOf(DEMO_IDS.workshop)).toMatchObject({
      type: "review_new",
      title: message.title,
      body: message.body,
      href: "/workshop/reviews",
      readAt: null,
    })
  })

  test("writes nothing when the person turned that kind off, or is gone", async () => {
    const before = await db.$count(notifications)
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
    await notify(db, { ...message, userId: "u-nope" })
    expect(await db.$count(notifications)).toBe(before)
    await notify(db, { ...message, type: "message" })
    expect(await db.$count(notifications)).toBe(before + 1)
  })
})

describe("toNotificationHref", () => {
  test("puts a role's dashboard in front of the pages that differ by role", () => {
    expect(toNotificationHref("user", "/messages?thread=t-1")).toBe(
      "/account/messages?thread=t-1"
    )
    expect(toNotificationHref("dealership", "/messages")).toBe(
      "/dealer/messages"
    )
    expect(toNotificationHref("workshop", "/messages")).toBe(
      "/workshop/inquiries"
    )
    expect(toNotificationHref("mechanic", "/messages")).toBe(
      "/mechanic/inquiries"
    )
    expect(toNotificationHref("dealership", "/listings")).toBe(
      "/dealer/inventory"
    )
    expect(toNotificationHref("user", "/listings")).toBe("/account/listings")
    expect(toNotificationHref("mechanic", "/billing")).toBe("/mechanic/billing")
    expect(toNotificationHref("user", "/listing/some-slug")).toBe(
      "/listing/some-slug"
    )
  })
})
