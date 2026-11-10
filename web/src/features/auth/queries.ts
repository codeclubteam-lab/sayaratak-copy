import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import type { ApiError } from "@/lib/api/client"
import { apiFetch } from "@/lib/api/client"
import { useApiMutation } from "@/lib/api/mutation"
import { keys, publicKeyRoots } from "@/lib/api/query-keys"
import { markSignIn } from "@/lib/sign-in-flag"
import { authClient } from "@/lib/auth-client"
import { authCall } from "@/lib/api/auth-error"
import {
  draftSchema,
  notificationPrefsSchema,
  okSchema,
  type NotificationPrefs,
} from "@sayaratak/shared/schemas/api"
import type { z } from "zod"
import type {
  oauthInputSchema,
  passwordInputSchema,
  profilePatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import { userSchema, type User } from "@sayaratak/shared/schemas/user"

export { meQuery } from "./me-query"
export {
  useLogin,
  useSignup,
  useResendSignup,
  useVerifySignup,
  useSocialLogin,
  useSendOtp,
  useVerifyOtp,
  useForgotPassword,
  useVerifyReset,
  useResetPassword,
  useSendAdminCode,
  useVerifyAdminCode,
} from "./auth-queries"
export const prefsQuery = queryOptions({
  queryKey: keys.prefs,
  queryFn: ({ signal }) =>
    apiFetch("/me/notification-prefs", {
      schema: notificationPrefsSchema,
      signal,
    }),
})
export const draftQuery = (key: string) =>
  queryOptions({
    queryKey: keys.drafts(key),
    queryFn: ({ signal }) =>
      apiFetch(`/drafts/${key}`, { schema: draftSchema, signal }),
    staleTime: 0,
  })

// After sign in the cache holds the user and personal queries refetch. A sign in (not a sign up) also arms the once-per-sign-in reminders.
function useSignedIn(signIn = true) {
  const qc = useQueryClient()
  return (user: User) => {
    if (signIn) markSignIn()
    qc.setQueryData(keys.me, user)
    void qc.invalidateQueries({
      predicate: (q) => q.queryKey[0] !== "me" && q.queryKey[0] !== "taxonomy",
    })
    return user
  }
}
const post =
  <TSchema extends z.ZodType>(path: string, schema: TSchema) =>
  (body?: unknown) =>
    apiFetch(path, { method: "POST", body, schema })

// Unmounted mock dialog only, removed in 11.2. Live social buttons use useSocialLogin.
export function useOauthLogin() {
  const signedIn = useSignedIn()
  return useApiMutation(
    (
      v: { provider: "google" | "facebook" } & z.input<typeof oauthInputSchema>
    ) =>
      post(
        `/auth/oauth/${v.provider}`,
        userSchema
      )({ accountId: v.accountId }).then(signedIn)
  )
}

function useSignedOut() {
  const qc = useQueryClient()
  return async () => {
    await qc.cancelQueries({ queryKey: keys.me })
    qc.setQueryData(keys.me, null)
    qc.removeQueries({
      predicate: (q) =>
        !publicKeyRoots.has(String(q.queryKey[0])) && q.queryKey[0] !== "me",
    })
  }
}
export function useLogout() {
  const signedOut = useSignedOut()
  return useApiMutation(() => authCall(authClient.signOut()).then(signedOut))
}
export function useDeleteAccount() {
  const signedOut = useSignedOut()
  return useApiMutation(() =>
    apiFetch("/me", { method: "DELETE", schema: okSchema }).then(signedOut)
  )
}
export function useUpdateProfile() {
  const qc = useQueryClient()
  return useApiMutation((body: z.input<typeof profilePatchSchema>) =>
    apiFetch("/me", { method: "PATCH", body, schema: userSchema }).then((u) => {
      qc.setQueryData(keys.me, u)
      return u
    })
  )
}
export function useChangePassword() {
  const qc = useQueryClient()
  return useApiMutation((body: z.input<typeof passwordInputSchema>) =>
    post(
      "/me/password",
      okSchema
    )(body).then((r) => {
      qc.setQueryData(keys.me, (me: User | null | undefined) =>
        me ? { ...me, hasPassword: true } : me
      )
      return r
    })
  )
}
// Each switch saves at once: the cache changes first and goes back when the call fails.
export function useUpdateNotificationPrefs() {
  const qc = useQueryClient()
  return useMutation<
    NotificationPrefs,
    ApiError,
    Partial<NotificationPrefs>,
    NotificationPrefs | undefined
  >({
    mutationFn: (body) =>
      apiFetch("/me/notification-prefs", {
        method: "PATCH",
        body,
        schema: notificationPrefsSchema,
      }),
    onMutate: async (body) => {
      await qc.cancelQueries({ queryKey: keys.prefs })
      const before = qc.getQueryData<NotificationPrefs>(keys.prefs)
      if (before) qc.setQueryData(keys.prefs, { ...before, ...body })
      return before
    },
    onError: (_error, _body, before) => qc.setQueryData(keys.prefs, before),
    onSettled: () => qc.invalidateQueries({ queryKey: keys.prefs }),
  })
}
// For a page that is closing or reloading: keepalive lets the request outlive it, and nobody is left to read a failure.
export const saveDraftOnExit = (key: string, data: Record<string, unknown>) =>
  void apiFetch(`/drafts/${key}`, {
    method: "PATCH",
    body: { data },
    schema: draftSchema,
    keepalive: true,
  }).catch(() => undefined)

export const useSaveDraft = (key: string) =>
  useApiMutation(
    (data: Record<string, unknown>) =>
      apiFetch(`/drafts/${key}`, {
        method: "PATCH",
        body: { data },
        schema: draftSchema,
      }),
    [keys.drafts(key)]
  )
