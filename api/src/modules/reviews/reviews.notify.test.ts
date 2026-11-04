import { beforeEach, describe, expect, test } from "bun:test"
import { and, eq } from "drizzle-orm"

import { user } from "~/modules/auth/auth.tables"
import { notifications } from "~/modules/notifications/notifications.tables"
import { db } from "~/shared/db/client"

import { DEMO_IDS, resetDb, signIn } from "../../../tests/helpers"
import { post, review } from "../../../tests/reviews"

const reviewNotices = (userId: string) =>
  db
    .select()
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.type, "review_new")
      )
    )

beforeEach(resetDb)

describe("POST /reviews tells the business's owner", () => {
  test("a bell notice in both languages that links to the owner's reviews page", async () => {
    const before = await reviewNotices(DEMO_IDS.dealership)
    await post(await signIn("user"), review)
    const after = await reviewNotices(DEMO_IDS.dealership)
    expect(after).toHaveLength(before.length + 1)
    const notice = after.find((n) => !before.some((b) => b.id === n.id))
    expect(notice).toMatchObject({
      title: { ar: "تقييم جديد", en: "New review" },
      body: { ar: "حصلت على 4 نجوم.", en: "You received 4 stars." },
      href: "/dealer/reviews",
      readAt: null,
    })
  })

  test("nothing when the owner switched review notices off", async () => {
    const [row] = await db
      .select({ prefs: user.prefs })
      .from(user)
      .where(eq(user.id, DEMO_IDS.dealership))
    await db
      .update(user)
      .set({ prefs: { ...row?.prefs, reviews: false } as never })
      .where(eq(user.id, DEMO_IDS.dealership))
    const before = await reviewNotices(DEMO_IDS.dealership)
    await post(await signIn("user"), review)
    expect(await reviewNotices(DEMO_IDS.dealership)).toHaveLength(before.length)
  })
})
