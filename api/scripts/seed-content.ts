import { eventTypeSchema } from "@sayaratak/shared/schemas/api"
import { sql } from "drizzle-orm"
import type { PgTable } from "drizzle-orm/pg-core"

import { backups } from "~/modules/admin-backups/admin-backups.tables"
import { events } from "~/modules/analytics/analytics.tables"
import { settings, sitePages } from "~/modules/content/content.tables"
import type { Executor } from "~/shared/db/tx"

import type { buildSeed } from "../../web/src/mocks/seed"

type Seed = ReturnType<typeof buildSeed>

const BYTES_PER_MB = 1024 * 1024

/** Settings, site pages, backups and event counters. */
export async function seedContent(ex: Executor, data: Seed) {
  await seedSite(ex, data)
  // Demo backups have no dump behind their key; restoring one fails with the object missing.
  await insert(
    ex,
    backups,
    data.backups.map((b) => ({
      id: b.id,
      type: b.type,
      status: b.status,
      objectKey: `demo/${b.id}.dump`,
      bytes: b.sizeMb * BYTES_PER_MB,
      createdAt: new Date(b.createdAt),
    }))
  )
  await seedEvents(ex, data)
}

/** The settings row and the site pages: reference data that production bootstrap writes too. */
export async function seedSite(
  ex: Executor,
  data: Pick<Seed, "settings" | "pages">
) {
  const { bankakAccount, ...rest } = data.settings
  await ex
    .insert(settings)
    .values({
      ...rest,
      bankakName: bankakAccount.name,
      bankakNumber: bankakAccount.number,
    })
    .onConflictDoNothing()
  await insert(
    ex,
    sitePages,
    data.pages.map(({ id: _, ...p }) => ({
      ...p,
      updatedAt: new Date(p.updatedAt),
    }))
  )
}

async function seedEvents(ex: Executor, data: Seed) {
  if (!data.events.length) return
  // The mock keeps one row per day and target with a count per type; a zero count is no row.
  const counters = data.events.flatMap((e) =>
    eventTypeSchema.options
      .map((type) => ({
        day: e.day,
        targetId: e.targetId,
        type,
        count: e.counts[type],
      }))
      .filter((row) => row.count > 0)
  )
  // Raw SQL: about 40,000 rows, which every test's `resetDb` writes. One `unnest` of four
  // arrays is one statement instead of 40 batches, and filling only an empty table stands in
  // for `on conflict do nothing`, which makes the insert six times slower.
  const column = <K extends keyof (typeof counters)[number]>(key: K) =>
    `{${counters.map((c) => c[key]).join(",")}}`
  await ex.execute(
    sql`insert into ${events} select * from unnest(${column("day")}::date[], ${column("targetId")}::text[], ${column("type")}::event_type[], ${column("count")}::int[]) where not exists (select from ${events})`
  )
}

// Typed by the table, so a row with a wrong column fails typecheck.
async function insert<T extends PgTable>(
  ex: Executor,
  table: T,
  rows: T["$inferInsert"][]
) {
  if (rows.length) await ex.insert(table).values(rows).onConflictDoNothing()
}
