import {
  MutationCache,
  QueryCache,
  type QueryClient,
} from "@tanstack/react-query"

import { ApiError } from "@/lib/api/client"
import { keys } from "@/lib/api/query-keys"
import { authGate } from "./auth-gate"

// A 401 `unauthenticated` from any query or mutation means the session ended: show signed out, open the auth dialog, and run the failed call again after sign in. Client only: the gate store must not hold state on the server.
function sessionEnded(qc: QueryClient, error: unknown, replay: () => void) {
  if (typeof window === "undefined") return
  if (!(error instanceof ApiError) || error.code !== "unauthenticated") return
  // Already signed out on purpose (sign out refetches personal queries for a moment): nothing ended. An open gate means this is a second call that failed with the first.
  if (qc.getQueryData(keys.me) === null && !authGate.state.open) return
  qc.setQueryData(keys.me, null)
  const { pending } = authGate.state
  authGate.setState(() => ({
    open: true,
    reason: "auth.session_ended",
    // Several calls can fail at once; each one runs again.
    pending: pending
      ? () => {
          pending()
          replay()
        }
      : replay,
  }))
}

// The failed mutation's own observers see it run again; a second failure goes through the same handler.
export const sessionCaches = (getClient: () => QueryClient) => ({
  queryCache: new QueryCache({
    onError: (error, query) =>
      sessionEnded(getClient(), error, () => {
        void getClient().invalidateQueries({ queryKey: query.queryKey })
      }),
  }),
  mutationCache: new MutationCache({
    onError: (error, variables, _result, mutation) =>
      sessionEnded(getClient(), error, () => {
        void mutation.execute(variables).catch(() => undefined)
      }),
  }),
})
