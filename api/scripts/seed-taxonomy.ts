import * as taxonomy from "~/modules/taxonomy/taxonomy.tables"
import type { Executor } from "~/shared/db/tx"

import type { buildSeed } from "../../web/src/mocks/seed"

type Seed = ReturnType<typeof buildSeed>

// Parents before children; rows go in array order, so `position` keeps the mock's order.
export async function seedTaxonomy(
  ex: Executor,
  data: Pick<Seed, "taxonomy" | "countries">
) {
  const { cities, districts, makes, models, ...lists } = data.taxonomy
  await ex
    .insert(taxonomy.countries)
    .values(data.countries)
    .onConflictDoNothing()
  await ex
    .insert(taxonomy.cities)
    .values(cities.map(({ center, ...city }) => ({ ...city, ...center })))
    .onConflictDoNothing()
  await ex.insert(taxonomy.districts).values(districts).onConflictDoNothing()
  await ex
    .insert(taxonomy.vehicleTypes)
    .values(lists.vehicleTypes)
    .onConflictDoNothing()
  await ex.insert(taxonomy.makes).values(makes).onConflictDoNothing()
  await ex.insert(taxonomy.models).values(models).onConflictDoNothing()
  await ex
    .insert(taxonomy.partCategories)
    .values(lists.partCategories)
    .onConflictDoNothing()
  await ex
    .insert(taxonomy.specializations)
    .values(lists.specializations)
    .onConflictDoNothing()
  await ex
    .insert(taxonomy.serviceTemplates)
    .values(lists.serviceTemplates)
    .onConflictDoNothing()
}
