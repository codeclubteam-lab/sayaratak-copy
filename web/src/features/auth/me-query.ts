import { queryOptions } from "@tanstack/react-query"

import { apiFetch } from "@/lib/api/client"
import { keys } from "@/lib/api/query-keys"
import { userSchema } from "@sayaratak/shared/schemas/user"

// Kept apart from the other auth hooks so the root route pulls in nothing else.
export const meQuery = queryOptions({
  queryKey: keys.me,
  queryFn: ({ signal }) =>
    apiFetch("/me", { schema: userSchema.nullable(), signal }),
  staleTime: 5 * 60_000,
})
