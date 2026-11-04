import { beforeEach, describe, expect, test } from "bun:test"
import { activitySchema } from "@sayaratak/shared/schemas/responses"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import { listings } from "~/modules/listings/listings.tables"

import {
  buildSeed,
  expectSchema,
  req,
  resetDb,
  signIn,
} from "../../../tests/helpers"

const seeded = buildSeed()

beforeEach(resetDb)

async function asAdmin(path: string) {
  const { cookie } = await signIn("admin")
  return req(path, { headers: { cookie } })
}

describe("GET /admin/activity", () => {
  test("is the ten newest events, newest first, with the screen that shows each", async () => {
    const res = await asAdmin("/admin/activity")
    expect(res.status).toBe(200)
    const { items } = await expectSchema(res, activitySchema)
    expect(items).toHaveLength(10)
    const times = items.map((item) => item.createdAt)
    expect(times).toEqual([...times].sort().reverse())
  })

  test("opens a pending listing in the review queue and leaves drafts out", async () => {
    const pending = seeded.listings.find((l) => l.moderation === "pending")
    const draft = seeded.listings.find((l) => l.moderation === "draft")
    await db
      .update(listings)
      .set({ createdAt: new Date("2031-01-01T00:00:00Z") })
      .where(eq(listings.id, draft?.id ?? ""))
    await db
      .update(listings)
      .set({ createdAt: new Date("2030-01-01T00:00:00Z") })
      .where(eq(listings.id, pending?.id ?? ""))
    const { items } = await expectSchema(
      await asAdmin("/admin/activity"),
      activitySchema
    )
    expect(items[0]).toMatchObject({
      id: pending?.id,
      type: "listing_submitted",
      href: `/admin/moderation?listing=${pending?.id}`,
    })
    expect(items.map((item) => item.id)).not.toContain(draft?.id)
  })

  test("names a business by kind in its link and a payment by its reference", async () => {
    const { items } = await expectSchema(
      await asAdmin("/admin/activity"),
      activitySchema
    )
    for (const item of items) {
      if (item.type === "business_joined")
        expect(item.href).toMatch(
          /^\/admin\/(dealership|workshop|mechanic)s\?id=/
        )
      if (item.type === "payment_submitted")
        expect(item.label.en).toMatch(/^SY-\d{6}$/)
    }
  })
})
