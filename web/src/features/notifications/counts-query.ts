import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api/client"
import { keys } from "@/lib/api/query-keys"
import { countsSchema } from "@sayaratak/shared/schemas/api"

export const countsQuery = queryOptions({
  queryKey: keys.counts,
  queryFn: ({ signal }) =>
    apiFetch("/me/counts", { schema: countsSchema, signal }),
  staleTime: 10_000,
  refetchOnWindowFocus: true,
})
