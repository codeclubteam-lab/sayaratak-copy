import { clock } from "~/shared/time/clock"
import { type Executor, transaction } from "~/shared/db/tx"

import { bootstrapData } from "./bootstrap-data"
import { seedPlans } from "./seed-billing"
import { seedSite } from "./seed-content"
import { seedTaxonomy } from "./seed-taxonomy"

/**
 * Writes the reference data a new site needs: countries and taxonomy, plans, promotion prices,
 * ad pages, site pages and settings. Every insert skips a row that exists, so a re-run never
 * overwrites what an admin edited (2.8). Safe in production: no people, listings or activity.
 */
export async function bootstrap(ex: Executor) {
  const now = clock.now().toISOString()
  await seedTaxonomy(ex, bootstrapData)
  await seedPlans(ex, bootstrapData)
  await seedSite(ex, {
    settings: bootstrapData.settings,
    pages: bootstrapData.pages.map((page) => ({ ...page, updatedAt: now })),
  })
}

if (import.meta.main) {
  await transaction(bootstrap)
  process.exit(0)
}
