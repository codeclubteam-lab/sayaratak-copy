import { keepPreviousData, queryOptions } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api/client"
import { keys } from "@/lib/api/query-keys"
import { mapResponseSchema } from "@sayaratak/shared/schemas/responses"
import type { MapSearch } from "./schemas"

// The vehicle filters apply to the vehicles layer only; `layers` repeats in the query string like every array param.
export type MapFilters = Omit<MapSearch, "lat" | "lng" | "zoom"> & {
  bbox?: string
}

// The last pins stay on screen while a new area loads.
export const mapQuery = (filters: MapFilters) =>
  queryOptions({
    queryKey: keys.map(filters),
    queryFn: ({ signal }) =>
      apiFetch("/map", { query: filters, schema: mapResponseSchema, signal }),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  })
