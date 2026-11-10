import { useState } from "react"
import { useQueryClient } from "@tanstack/react-query"

import { ApiError, apiFetch } from "@/lib/api/client"
import { useApiMutation } from "@/lib/api/mutation"
import { keys } from "@/lib/api/query-keys"
import { markSignIn } from "@/lib/sign-in-flag"
import { userSchema, type User } from "@sayaratak/shared/schemas/user"

type Challenge = { twoFactorRedirect: true }

// An accepted OTP is consumed. If /me fails afterward, retry only that read,
// never the authentication request. Both phases retain their own error state.
export function useSessionMutation<TVars, TChallenge extends Challenge = never>(
  authenticate: (body: TVars) => Promise<TChallenge | void>,
  signIn = true
) {
  const qc = useQueryClient()
  const [authenticated, setAuthenticated] = useState(false)
  const session = useApiMutation(async () => {
    await qc.cancelQueries({ queryKey: keys.me })
    const user = await apiFetch("/me", { schema: userSchema.nullable() })
    if (!user) throw new ApiError(401, "unauthenticated")
    if (signIn) markSignIn()
    qc.setQueryData(keys.me, user)
    void qc.invalidateQueries({
      predicate: (q) => q.queryKey[0] !== "me" && q.queryKey[0] !== "taxonomy",
    })
    return user
  })
  const mutation = useApiMutation<TVars, User | TChallenge>(async (body) => {
    setAuthenticated(false)
    session.reset()
    const challenge = await authenticate(body)
    if (challenge) return challenge
    setAuthenticated(true)
    return session.mutateAsync()
  })
  return {
    ...mutation,
    authenticated,
    session,
    reset: () => {
      setAuthenticated(false)
      session.reset()
      mutation.reset()
    },
  }
}
