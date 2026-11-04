import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api/client"
import { keys } from "@/lib/api/query-keys"
import { type Range } from "@sayaratak/shared/schemas/api"
import { analyticsSchema } from "@sayaratak/shared/schemas/responses"

// Role scoped by the server: seller, dealership, workshop, mechanic or admin totals and daily series.
export const analyticsQuery = (range: Range = "30d") =>
  queryOptions({
    queryKey: keys.analytics(range),
    queryFn: ({ signal }) =>
      apiFetch("/me/analytics", {
        query: { range },
        schema: analyticsSchema,
        signal,
      }),
    staleTime: 60_000,
  })
