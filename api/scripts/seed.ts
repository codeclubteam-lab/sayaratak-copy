import type { Executor } from "~/shared/db/tx"

import { seedBilling, seedPlans } from "./seed-billing"
import { seedContent } from "./seed-content"
import { writeDemoFiles } from "./seed-files"
import { seedListings } from "./seed-listings"
import { seedPeople } from "./seed-people"
import { seedSocial } from "./seed-social"
import { seedTaxonomy } from "./seed-taxonomy"

import { buildSeed } from "../../web/src/mocks/seed"

/**
 * Writes the demo data from the mock's own `buildSeed()`, so ids and demo
 * accounts match the mock (A13). Each Phase 2 step adds its tables here.
 */
export async function seed(ex: Executor) {
  const data = buildSeed()
  await seedTaxonomy(ex, data)
  await seedPlans(ex, data)
  await seedPeople(ex, data)
  await seedListings(ex, data)
  await seedSocial(ex, data)
  await seedBilling(ex, data)
  await seedContent(ex, data)
  await writeDemoFiles(data)
}

if (import.meta.main) {
  // A2: demo people and listings never reach production. Read before `~/env` parses, so the
  // refusal holds even when production variables are missing.
  if (Bun.env.APP_ENV === "production") {
    process.stderr.write("db:seed refuses to run when APP_ENV=production\n")
    process.exit(1)
  }
  const { db } = await import("~/shared/db/client")
  await seed(db)
}
