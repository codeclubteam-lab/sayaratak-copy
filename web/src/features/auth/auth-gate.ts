import { useQuery } from "@tanstack/react-query"
import { createStore, useSelector } from "@tanstack/react-store"
import { useCallback } from "react"

import { meQuery } from "./me-query"

// Client only: holds no data that is rendered on the server.
type Gate = { open: boolean; reason?: string; pending: (() => void) | null }
export const authGate = createStore<Gate>({ open: false, pending: null })

export const useAuthGate = () => useSelector(authGate, (s) => s)
export const closeAuthGate = () =>
  authGate.setState(() => ({ open: false, pending: null }))
// Called by the auth dialog after sign in (once `me` is in the cache): closes it and replays the stored action.
export function resolveAuthGate() {
  const { pending } = authGate.state
  closeAuthGate()
  pending?.()
}

export function useRequireAuth() {
  const { data: me } = useQuery(meQuery)
  return useCallback(
    (action: () => void, reason?: string) => {
      if (me) return action()
      authGate.setState(() => ({ open: true, reason, pending: action }))
    },
    [me]
  )
}
