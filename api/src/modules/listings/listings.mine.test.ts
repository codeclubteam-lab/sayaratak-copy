import { beforeEach, describe, expect, spyOn, test } from "bun:test"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { listingSchema } from "@sayaratak/shared/schemas/listing"
import { and, asc, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { clock } from "~/shared/time/clock"
import { user } from "~/modules/auth/auth.tables"

import {
  DEMO_IDS,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"
import { listings } from "./listings.tables"

beforeEach(resetDb)

const DAY_MS = 86_400_000
const getAs = (query: string, cookie: string) =>
  req(`/me/listings?${query}`, { headers: { cookie } })
const mine = async (query: string, cookie: string) =>
  expectSchema(await getAs(query, cookie), pageOf(listingSchema))

async function firstApproved() {
  const [row] = await db
    .select()
    .from(listings)
    .where(
      and(
        eq(listings.ownerUserId, DEMO_IDS.user),
        eq(listings.moderation, "approved"),
        eq(listings.status, "available")
      )
    )
    .orderBy(asc(listings.id))
    .limit(1)
  if (!row) throw new Error("no approved listing of u-omar")
  return row
}

describe("GET /me/listings", () => {
  test("401 signed out, 403 for a workshop, 403 banned", async () => {
    expect((await req("/me/listings")).status).toBe(401)
    const workshop = await signIn("workshop")
    expect((await getAs("", workshop.cookie)).status).toBe(403)
    const { cookie } = await signIn("user")
    await db
      .update(user)
      .set({ banned: true })
      .where(eq(user.id, DEMO_IDS.user))
    const banned = await getAs("", cookie)
    expect(banned.status).toBe(403)
    expect(await banned.json()).toMatchObject({ code: "banned" })
  })

  test("only the owner's own listings, removed ones left out, exact pins", async () => {
    const { cookie } = await signIn("user")
    const row = await firstApproved()
    await db
      .update(listings)
      .set({ moderation: "removed" })
      .where(eq(listings.id, row.id))
    const page = await mine("pageSize=500", cookie)
    expect(page.items.every((l) => l.owner.id === DEMO_IDS.user)).toBe(true)
    expect(page.items.some((l) => l.id === row.id)).toBe(false)
    const pinned = page.items.find((l) => l.location)
    const [stored] = await db
      .select()
      .from(listings)
      .where(eq(listings.id, pinned?.id ?? ""))
    expect(pinned?.location).toEqual({
      lat: stored?.lat ?? 0,
      lng: stored?.lng ?? 0,
    })
  })

  test("a listing moves to expired once its date passes, and needs attention a week before", async () => {
    const { cookie } = await signIn("user")
    const row = await firstApproved()
    const ids = async (query: string) =>
      (await mine(`${query}&pageSize=500`, cookie)).items.map((l) => l.id)
    expect(await ids("tab=active")).toContain(row.id)
    spyOn(clock, "now").mockReturnValue(
      new Date(row.expiresAt.getTime() - 6 * DAY_MS)
    )
    expect(await ids("needsAttention=true")).toContain(row.id)
    spyOn(clock, "now").mockReturnValue(
      new Date(row.expiresAt.getTime() + 1000)
    )
    expect(await ids("tab=expired")).toContain(row.id)
    expect(await ids("tab=active")).not.toContain(row.id)
    spyOn(clock, "now").mockRestore()
  })

  test("a reserved listing untouched for 14 days needs attention", async () => {
    const { cookie } = await signIn("user")
    const row = await firstApproved()
    await db
      .update(listings)
      .set({
        status: "reserved",
        updatedAt: new Date(Date.now() - 14 * DAY_MS),
        expiresAt: new Date(Date.now() + 20 * DAY_MS),
      })
      .where(eq(listings.id, row.id))
    const page = await mine("needsAttention=true&pageSize=500", cookie)
    expect(page.items.map((l) => l.id)).toContain(row.id)
  })

  test("pageSize caps at 500, limit at 24, and a page past the end is empty", async () => {
    const { cookie } = await signIn("dealership")
    expect((await mine("pageSize=9999", cookie)).pageSize).toBe(500)
    expect((await mine("limit=99", cookie)).pageSize).toBe(24)
    const past = await mine("page=99", cookie)
    expect(past.items).toHaveLength(0)
    expect(past.total).toBeGreaterThan(0)
  })
})
