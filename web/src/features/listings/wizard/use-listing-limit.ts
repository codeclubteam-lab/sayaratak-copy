import { useQuery } from "@tanstack/react-query"

import { meQuery } from "@/features/auth/me-query"
import { billingQueries } from "@/features/billing/queries"

// The free-limit state of the person publishing. Nothing applies to a signed-out visitor, to a plan without a cap, or to an edit, which never counts against the limit.
export function useListingLimit(editing: boolean) {
  const { data: me } = useQuery(meQuery)
  const { data } = useQuery({
    ...billingQueries.subscription,
    enabled: !!me && !editing,
  })
  const limit = editing ? null : (data?.usage.limit ?? null)
  const used = data?.usage.used ?? 0
  return { me, used, limit, reached: limit !== null && used >= limit }
}
