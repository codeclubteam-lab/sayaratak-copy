import { beforeAll, describe, expect, test } from "bun:test"
import { getTableName, is, sql } from "drizzle-orm"
import { PgTable } from "drizzle-orm/pg-core"

import { db } from "~/shared/db/client"
import * as schema from "~/shared/db/schema"

import { buildSeed, resetDb } from "./helpers"

const seeded = buildSeed()
const { taxonomy: tax } = seeded
const count = (rows: { length: number }) => rows.length
const sum = <T>(rows: T[], of: (row: T) => number) =>
  rows.reduce((total, row) => total + of(row), 0)

// Every table and the number of rows the mock's seed gives it. A table missing here fails the
// last test, so a new table cannot skip the seed by accident.
const expected = new Map<PgTable, number>([
  [schema.countries, count(seeded.countries)],
  [schema.cities, count(tax.cities)],
  [schema.districts, count(tax.districts)],
  [schema.vehicleTypes, count(tax.vehicleTypes)],
  [schema.makes, count(tax.makes)],
  [schema.models, count(tax.models)],
  [schema.partCategories, count(tax.partCategories)],
  [schema.specializations, count(tax.specializations)],
  [schema.serviceTemplates, count(tax.serviceTemplates)],
  [schema.user, count(seeded.users)],
  // One credential account per user, so every demo account signs in with its password.
  [schema.account, count(seeded.users)],
  [schema.dealerships, count(seeded.dealerships)],
  [schema.workshops, count(seeded.workshops)],
  [schema.workshopImages, sum(seeded.workshops, (w) => w.images.length)],
  [schema.workshopServices, sum(seeded.workshops, (w) => w.services.length)],
  [schema.mechanics, count(seeded.mechanics)],
  [schema.mechanicCities, sum(seeded.mechanics, (m) => m.servedCityIds.length)],
  [
    schema.mechanicSpecializations,
    sum(seeded.mechanics, (m) => m.specializationIds.length),
  ],
  [schema.portfolioItems, sum(seeded.mechanics, (m) => m.portfolio.length)],
  [schema.listings, count(seeded.listings)],
  [schema.listingStats, count(seeded.listings)],
  [schema.listingMedia, sum(seeded.listings, (l) => l.media.length)],
  [schema.drafts, count(seeded.drafts)],
  [schema.reviews, count(seeded.reviews)],
  [schema.favorites, count(seeded.favorites)],
  [schema.savedSearches, count(seeded.savedSearches)],
  [schema.threads, count(seeded.threads)],
  [
    schema.threadParticipants,
    sum(seeded.threads, (t) => t.participantIds.length),
  ],
  [schema.messages, count(seeded.messages)],
  [schema.notifications, count(seeded.notifications)],
  [schema.reports, count(seeded.reports)],
  [schema.verificationRequests, count(seeded.verifications)],
  [
    schema.verificationDocuments,
    sum(seeded.verifications, (v) => v.documents.length),
  ],
  [schema.plans, count(seeded.plans)],
  [schema.subscriptions, count(seeded.subscriptions)],
  [schema.payments, count(seeded.payments)],
  [schema.promotionPrices, count(seeded.promotionPrices)],
  [schema.promotions, count(seeded.promotions)],
  [schema.adPages, count(seeded.adPages)],
  [schema.campaigns, count(seeded.campaigns)],
  [schema.banners, count(seeded.banners)],
  [schema.settings, 1],
  [schema.sitePages, count(seeded.pages)],
  [schema.backups, count(seeded.backups)],
  [schema.contacts, count(seeded.contacts)],
  [schema.broadcasts, count(seeded.broadcasts)],
])

// Tables the mock has no rows for: runtime state (sessions, codes, throttles, keys, audit, mail).
const runtimeOnly = new Set([
  schema.session,
  schema.verification,
  schema.twoFactor,
  schema.rateLimit,
  schema.loginFailures,
  schema.auditLog,
  schema.idempotencyKeys,
  schema.outbox,
  schema.devices,
  schema.fileDeletions,
  schema.eventsMonthly,
])

beforeAll(resetDb)

describe("db:seed", () => {
  for (const [table, rows] of expected)
    test(`fills ${getTableName(table)} with the mock's ${rows} rows`, async () => {
      expect(await db.$count(table)).toBe(rows)
    })

  test("leaves runtime tables empty", async () => {
    for (const table of runtimeOnly) expect(await db.$count(table)).toBe(0)
  })

  test("keeps every event count of the mock, zero counts as no row", async () => {
    const [row] = await db
      .select({ total: sql<number>`sum(${schema.events.count})::int` })
      .from(schema.events)
    expect(row?.total).toBe(
      sum(seeded.events, (e) => sum(Object.values(e.counts), (n) => n))
    )
  })

  test("names every table in this file", () => {
    const listed = new Set([
      ...expected.keys(),
      ...runtimeOnly,
      // Checked by the event total above.
      schema.events,
      // Uploads come from many seed rows; `shared/files/demo.test.ts` checks the private ones.
      schema.uploads,
    ])
    const tables = Object.values(schema).filter((value) => is(value, PgTable))
    expect(tables.length).toBe(listed.size)
    expect(
      tables.filter((t) => !listed.has(t)).map((t) => getTableName(t))
    ).toEqual([])
  })
})

describe("db:seed in production", () => {
  test("refuses to run and writes nothing", async () => {
    const run = Bun.spawn(["bun", "scripts/seed.ts"], {
      env: { ...process.env, APP_ENV: "production" },
      stderr: "pipe",
    })
    expect(await run.exited).toBe(1)
    expect(await new Response(run.stderr).text()).toContain(
      "refuses to run when APP_ENV=production"
    )
  })
})
