import { useQuery } from "@tanstack/react-query"

import { taxonomyQuery } from "@/features/listings/queries"
import { homeQueries } from "./queries"

// Every make of an enabled vehicle type, and a vehicle count per make. The counts are the facets of the "Newly added" rail, so they cost no request of their own (and are undefined until it loads).
export function useMakes() {
  const taxonomy = useQuery(taxonomyQuery).data
  const facets = useQuery({
    ...homeQueries.newest,
    select: (page) => page.facets.make,
  }).data
  const enabled = new Set(
    taxonomy?.vehicleTypes.filter((v) => v.enabled).map((v) => v.id)
  )
  const makes = (taxonomy?.makes ?? []).filter((m) =>
    m.vehicleTypes.some((v) => enabled.has(v))
  )
  const countOf = (id: string) =>
    facets && (facets.find((f) => f.value === id)?.count ?? 0)
  return { makes, countOf }
}
