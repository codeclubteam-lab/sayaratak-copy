import { useQueryClient } from "@tanstack/react-query"
import { useRouter } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import { meQuery } from "./me-query"
import { signInDestination } from "./destination"

// For the /auth page: once a step has put `me` in the cache, go to the destination.
export function useAuthDone(redirect?: string) {
  const qc = useQueryClient()
  const router = useRouter()
  const { locale } = useT()
  return () => {
    const me = qc.getQueryData(meQuery.queryKey)
    if (me) router.history.push(signInDestination(me, redirect, locale))
  }
}
