import { useQueryClient } from "@tanstack/react-query"

import { useApiMutation } from "@/lib/api/mutation"
import { keys } from "@/lib/api/query-keys"
import { authClient } from "@/lib/auth-client"
import type { User } from "@sayaratak/shared/schemas/user"
import { authCall } from "@/lib/api/auth-error"
import type { LoginForm, SignupForm } from "./schemas"
import { useSessionMutation } from "./session-mutation"

export function useLogin() {
  return useSessionMutation<LoginForm, { twoFactorRedirect: true }>(
    async (body) => {
      const data = await authCall(authClient.signIn.email(body))
      if ("twoFactorRedirect" in data && data.twoFactorRedirect === true)
        return { twoFactorRedirect: true }
    }
  )
}
export const useSendAdminCode = () =>
  useApiMutation(() =>
    authCall(authClient.twoFactor.sendOtp({ trustDevice: false }))
  )
export function useVerifyAdminCode() {
  return useSessionMutation(async (code: string) => {
    await authCall(authClient.twoFactor.verifyOtp({ code, trustDevice: false }))
  })
}
export const useSignup = () =>
  useApiMutation((body: Pick<SignupForm, "fullName" | "email" | "password">) =>
    authCall(
      authClient.signUp.email({
        name: body.fullName,
        email: body.email,
        password: body.password,
      })
    )
  )
export const useResendSignup = () =>
  useApiMutation((email: string) =>
    authCall(
      authClient.emailOtp.sendVerificationOtp({
        email,
        type: "email-verification",
      })
    )
  )
export function useVerifySignup() {
  return useSessionMutation(
    async ({ email, code }: { email: string; code: string }) => {
      await authCall(authClient.emailOtp.verifyEmail({ email, otp: code }))
    },
    false
  )
}
export const useSocialLogin = () =>
  useApiMutation(
    (body: {
      provider: "google" | "facebook"
      callbackURL: string
      errorCallbackURL: string
    }) => authCall(authClient.signIn.social(body))
  )

export function useSendOtp() {
  const qc = useQueryClient()
  return useApiMutation(({ identifier }: { identifier: string }) => {
    const me = qc.getQueryData<User | null>(keys.me)
    return authCall(
      me && identifier !== me.email
        ? authClient.emailOtp.requestEmailChange({ newEmail: identifier })
        : authClient.emailOtp.sendVerificationOtp({
            email: identifier,
            type: "email-verification",
          })
    )
  })
}
export function useVerifyOtp() {
  return useSessionMutation(
    async ({ identifier, code }: { identifier: string; code: string }) => {
      await authCall(
        authClient.emailOtp.verifyEmail({ email: identifier, otp: code })
      )
    },
    false
  )
}
export const useForgotPassword = () =>
  useApiMutation((body: { email: string }) =>
    authCall(authClient.emailOtp.requestPasswordReset(body))
  )
export const useVerifyReset = () =>
  useApiMutation(async ({ email, code }: { email: string; code: string }) => {
    await authCall(
      authClient.emailOtp.checkVerificationOtp({
        email,
        otp: code,
        type: "forget-password",
      })
    )
    return { email, code }
  })
export const useResetPassword = () =>
  useApiMutation(
    ({
      email,
      code,
      password,
    }: {
      email: string
      code: string
      password: string
    }) =>
      authCall(
        authClient.emailOtp.resetPassword({ email, otp: code, password })
      )
  )
