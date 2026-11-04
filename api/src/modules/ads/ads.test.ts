import { beforeEach, describe, expect, test } from "bun:test"
import { asc, eq } from "drizzle-orm"

import { db } from "~/shared/db/client"

import { buildSeed, resetDb } from "../../../tests/helpers"
import { adPages, banners, campaigns } from "./ads.tables"

const seeded = buildSeed()

beforeEach(resetDb)

describe("ad tables", () => {
  test("hold every mock ad page in order, campaign and banner", async () => {
    const pages = await db
      .select({ id: adPages.id })
      .from(adPages)
      .orderBy(asc(adPages.position))
    expect(pages.map((p) => p.id)).toEqual(seeded.adPages.map((p) => p.id))
    expect(await db.$count(campaigns)).toBe(seeded.campaigns.length)
    expect(await db.$count(banners)).toBe(seeded.banners.length)
  })

  test("refuse a campaign with no page or more than 4 weeks", async () => {
    const id = seeded.campaigns[0]?.id ?? ""
    const update = (set: Partial<typeof campaigns.$inferInsert>) =>
      db
        .update(campaigns)
        .set(set)
        .where(eq(campaigns.id, id))
        .catch((error) => error.cause.constraint)
    expect(await update({ pages: [] })).toBe("campaigns_pages")
    expect(await update({ weeks: 5 })).toBe("campaigns_weeks")
  })
})
