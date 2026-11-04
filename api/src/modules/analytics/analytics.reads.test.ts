import { afterEach, beforeAll, describe, expect, spyOn, test } from "bun:test"
import { analyticsSchema } from "@sayaratak/shared/schemas/responses"
import { asc, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"
import { banners } from "~/modules/ads/ads.tables"
import {
  messages,
  threadParticipants,
} from "~/modules/messaging/messaging.tables"

import {
  expectSchema,
  req,
  resetDb,
  type SignedIn,
  signIn,
} from "../../../tests/helpers"
import { events } from "./analytics.tables"

// Fixed, so "today" and the windows do not move while the suite runs.
const NOON = new Date("2026-11-01T12:00:00Z")

let as: Record<"user" | "dealership" | "admin" | "new", SignedIn>

beforeAll(async () => {
  await resetDb()
  as = {
    user: await signIn("user"),
    dealership: await signIn("dealership"),
    admin: await signIn("admin"),
    new: await signIn("new"),
  }
})
afterEach(() => spyOn(clock, "now").mockRestore())

const get = (path: string, who?: SignedIn) =>
  req(path, { headers: who ? { cookie: who.cookie } : {} })

const mine = async (who: SignedIn, query = "") =>
  expectSchema(await get(`/me/analytics${query}`, who), analyticsSchema)

describe("GET /me/analytics", () => {
  test("needs a session", async () => {
    expect((await get("/me/analytics")).status).toBe(401)
  })

  test("a window is that many whole days ending today, oldest first", async () => {
    spyOn(clock, "now").mockReturnValue(NOON)
    for (const [range, length] of [
      ["7d", 7],
      ["30d", 30],
      ["90d", 90],
      ["", 30],
      ["1y", 30],
    ] as const) {
      const body = await mine(as.user, `?range=${range}`)
      expect(body.daily).toHaveLength(length)
      expect(body.daily.at(-1)?.date).toBe("2026-11-01")
      expect(body.daily[0]?.date).toBe(
        new Date(Date.parse("2026-11-01") - (length - 1) * 86_400_000)
          .toISOString()
          .slice(0, 10)
      )
    }
  })

  test("totals add up the daily series, and previous is the window before", async () => {
    const body = await mine(as.user, "?range=7d")
    const sum = (key: "views" | "calls" | "whatsapp" | "messages") =>
      body.daily.reduce((total, day) => total + day[key], 0)
    expect(body.totals.views).toBe(sum("views"))
    expect(body.totals.calls).toBe(sum("calls"))
    expect(body.totals.whatsapp).toBe(sum("whatsapp"))
    expect(body.totals.messages).toBe(sum("messages"))
    // 14 days back holds the 7 days before the window, so asking for it gives the same numbers.
    const wide = await mine(as.user, "?range=30d")
    const lastWeek = wide.daily.slice(-14, -7)
    expect(body.previous.views).toBe(
      lastWeek.reduce((total, day) => total + day.views, 0)
    )
  })

  test("a seller sees their own listings, an admin everything, a new account zeros", async () => {
    const user = await mine(as.user)
    const admin = await mine(as.admin)
    const fresh = await mine(as.new)
    expect(user.totals.views).toBeGreaterThan(0)
    expect(admin.totals.views).toBeGreaterThan(user.totals.views)
    expect(fresh.totals).toEqual({
      views: 0,
      calls: 0,
      whatsapp: 0,
      messages: 0,
      favorites: 0,
      newReviews: 0,
    })
    expect(fresh.daily.every((day) => day.views === 0)).toBe(true)
  })

  test("banner events never count as views or calls", async () => {
    spyOn(clock, "now").mockReturnValue(NOON)
    const before = await mine(as.admin)
    const [banner] = await db.select({ id: banners.id }).from(banners).limit(1)
    await db.insert(events).values({
      day: "2026-11-01",
      targetId: banner?.id ?? "",
      type: "banner_click",
      count: 500,
    })
    expect((await mine(as.admin)).totals).toEqual(before.totals)
  })

  test("only a dealership gets its ten best listings, most viewed first, with a cover", async () => {
    expect((await mine(as.user)).topListings).toEqual([])
    expect((await mine(as.admin)).topListings).toEqual([])
    const top = (await mine(as.dealership)).topListings
    expect(top.length).toBeGreaterThan(1)
    expect(top.length).toBeLessThanOrEqual(10)
    expect(top.map((item) => item.views)).toEqual(
      top.map((item) => item.views).sort((a, b) => b - a)
    )
    expect(top.every((item) => item.coverUrl && item.slug)).toBe(true)
  })

  test("a listing with the most views today moves to the top of the dealership's list", async () => {
    spyOn(clock, "now").mockReturnValue(NOON)
    const [last] = (await mine(as.dealership)).topListings.slice(-1)
    await db
      .insert(events)
      .values({
        day: "2026-11-01",
        targetId: last?.id ?? "",
        type: "view",
        count: 1_000_000,
      })
      .onConflictDoUpdate({
        target: [events.targetId, events.day, events.type],
        set: { count: 1_000_000 },
      })
    const top = (await mine(as.dealership)).topListings
    expect(top[0]?.id).toBe(last?.id ?? "")
    expect(top[0]?.views).toBeGreaterThanOrEqual(1_000_000)
  })

  test("messages count on the Khartoum day, so 22:30 UTC belongs to the next one", async () => {
    spyOn(clock, "now").mockReturnValue(NOON)
    const [mineThread] = await db
      .select({ threadId: threadParticipants.threadId })
      .from(threadParticipants)
      .where(eq(threadParticipants.userId, "u-omar"))
      .orderBy(asc(threadParticipants.threadId))
    const sender = (
      await db
        .select({ userId: threadParticipants.userId })
        .from(threadParticipants)
        .where(eq(threadParticipants.threadId, mineThread?.threadId ?? ""))
    ).find((row) => row.userId !== "u-omar")
    const day = (body: Awaited<ReturnType<typeof mine>>, date: string) =>
      body.daily.find((d) => d.date === date)?.messages ?? 0
    const before = await mine(as.user)
    await db.insert(messages).values({
      id: "m-khartoum",
      threadId: mineThread?.threadId ?? "",
      senderId: sender?.userId ?? "",
      body: "late",
      createdAt: new Date("2026-10-30T22:30:00Z"),
    })
    const after = await mine(as.user)
    expect(day(after, "2026-10-30")).toBe(day(before, "2026-10-30"))
    expect(day(after, "2026-10-31")).toBe(day(before, "2026-10-31") + 1)
  })
})
