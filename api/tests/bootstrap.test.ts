import { beforeEach, describe, expect, test } from "bun:test"
import { eq } from "drizzle-orm"

import { db } from "~/shared/db/client"
import * as schema from "~/shared/db/schema"

import { bootstrap } from "../scripts/bootstrap"
import { bootstrapData } from "../scripts/bootstrap-data"
import {
  BOOTSTRAP_DATA_FILE,
  renderBootstrapData,
} from "../scripts/bootstrap-data.make"
import { emptyDb } from "./helpers"

beforeEach(emptyDb)

const snapshot = async () =>
  Promise.all(
    [
      schema.countries,
      schema.cities,
      schema.makes,
      schema.models,
      schema.plans,
      schema.promotionPrices,
      schema.adPages,
      schema.sitePages,
      schema.settings,
    ].map((table) => db.select().from(table))
  )

describe("bootstrap", () => {
  test("the committed bootstrap-data.ts is current (run `bun run bootstrap:data`)", async () => {
    expect(await Bun.file(BOOTSTRAP_DATA_FILE).text()).toBe(
      renderBootstrapData()
    )
  })

  test("fills an empty DB with reference data and no people, listings or activity", async () => {
    await bootstrap(db)
    expect(await db.$count(schema.cities)).toBe(
      bootstrapData.taxonomy.cities.length
    )
    expect(await db.$count(schema.plans)).toBe(bootstrapData.plans.length)
    expect(await db.$count(schema.sitePages)).toBe(bootstrapData.pages.length)
    expect(await db.$count(schema.settings)).toBe(1)
    for (const table of [
      schema.user,
      schema.listings,
      schema.dealerships,
      schema.reviews,
      schema.payments,
      schema.events,
      schema.banners,
      schema.campaigns,
      schema.backups,
    ])
      expect(await db.$count(table)).toBe(0)
  })

  test("a second run changes nothing", async () => {
    await bootstrap(db)
    const first = await snapshot()
    await bootstrap(db)
    expect(await snapshot()).toEqual(first)
  })

  test("never overwrites what an admin edited", async () => {
    await bootstrap(db)
    const plan = bootstrapData.plans[1]?.id ?? ""
    await db
      .update(schema.plans)
      .set({ price: 1 })
      .where(eq(schema.plans.id, plan))
    await db.update(schema.settings).set({ bankakNumber: "999" })
    await bootstrap(db)
    const [row] = await db
      .select({ price: schema.plans.price })
      .from(schema.plans)
      .where(eq(schema.plans.id, plan))
    expect(row?.price).toBe(1)
    const [site] = await db.select().from(schema.settings)
    expect(site?.bankakNumber).toBe("999")
  })
})
