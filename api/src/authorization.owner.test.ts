import { beforeAll, describe, expect, test } from "bun:test"
import { and, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { devices } from "~/modules/devices/devices.tables"
import { favorites } from "~/modules/favorites/favorites.tables"
import { listings } from "~/modules/listings/listings.tables"
import {
  messages,
  threadParticipants,
} from "~/modules/messaging/messaging.tables"
import { notifications } from "~/modules/notifications/notifications.tables"
import { reviews } from "~/modules/reviews/reviews.tables"
import { savedSearches } from "~/modules/saved-searches/saved-searches.tables"

import { DEMO_IDS, resetDb, type SignedIn, signIn } from "../tests/helpers"
import { send } from "../tests/listings"
import { OWNED } from "../tests/owned-calls"
import { post as postReview, review } from "../tests/reviews"
import { hit, keyOf, v1Routes } from "../tests/sweep"

// 10.3, part 2: a stranger calls every route that takes an id of user A's
// (A = the demo "user", Omar) and none of A's data changes.
const omar = DEMO_IDS.user
const REFUSED = [403, 404]

/** Every row of A's that a stranger's call could change, as one string. */
async function snapshot() {
  return JSON.stringify([
    await db.select().from(listings).where(eq(listings.ownerUserId, omar)),
    await db.select().from(savedSearches).where(eq(savedSearches.userId, omar)),
    await db.select().from(favorites).where(eq(favorites.userId, omar)),
    await db.select().from(devices).where(eq(devices.userId, omar)),
    await db.select().from(reviews).where(eq(reviews.authorId, omar)),
    await db
      .select()
      .from(threadParticipants)
      .where(eq(threadParticipants.userId, omar)),
    await db.select().from(notifications).where(eq(notifications.userId, omar)),
    (await db.select().from(messages)).length,
  ])
}

function route(key: string) {
  const found = v1Routes().find((r) => keyOf(r) === key)
  if (!found) throw new Error(`no route ${key}`)
  return found
}

let strangers: { dealer: SignedIn; workshop: SignedIn }
let fixtures: Record<"listing" | "search" | "thread" | "review", string>
let favoriteId = ""
let before = ""

beforeAll(async () => {
  await resetDb()
  strangers = {
    dealer: await signIn("dealership"),
    workshop: await signIn("workshop"),
  }
  const as = await signIn("user")
  const [listing] = await db
    .select()
    .from(listings)
    .where(
      and(eq(listings.ownerUserId, omar), eq(listings.moderation, "approved"))
    )
  const [search] = await db
    .select()
    .from(savedSearches)
    .where(eq(savedSearches.userId, omar))
  const [fav] = await db
    .select()
    .from(favorites)
    .where(eq(favorites.userId, omar))
  const [thread] = await db
    .select()
    .from(threadParticipants)
    .where(eq(threadParticipants.userId, omar))
  const posted = (await (await postReview(as, review)).json()) as { id: string }
  await send(as, "/me/devices", {
    method: "POST",
    body: {
      platform: "android",
      fcmToken: "tok:omar",
      appVersion: "1",
      locale: "ar",
    },
  })
  favoriteId = fav?.listingId ?? ""
  fixtures = {
    listing: listing?.id ?? "",
    search: search?.id ?? "",
    thread: thread?.threadId ?? "",
    review: posted.id,
  }
  before = await snapshot()
})

test("A has the data the sweep needs", () => {
  expect(Object.values(fixtures).every(Boolean)).toBe(true)
  expect(favoriteId).not.toBe("")
})

describe("a stranger with A's ids", () => {
  test.each(OWNED)("$route is 403 or 404", async (call) => {
    const ids = Object.fromEntries(
      Object.entries(call.ids).map(([param, key]) => [param, fixtures[key]])
    )
    const res = await hit(route(call.route), {
      as: strangers[call.who],
      ids,
      body: call.body,
    })
    expect(REFUSED).toContain(res.status)
  })

  test("deleting A's favorite and device, and marking A's notices read, touch the stranger's own rows only", async () => {
    const as = strangers.dealer
    await hit(route("DELETE /favorites/:listingId"), {
      as,
      ids: { listingId: favoriteId },
    })
    await hit(route("DELETE /me/devices/:fcmToken"), {
      as,
      ids: { fcmToken: "tok:omar" },
    })
    const mine = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, omar))
    await hit(route("POST /notifications/read"), {
      as,
      body: { ids: mine.map((n) => n.id) },
    })
  })

  test("nothing of A's changed", async () => {
    expect(await snapshot()).toBe(before)
  })
})
