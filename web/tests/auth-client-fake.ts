import { vi } from "vitest"

import { db, newId } from "@/mocks/db"
import { defaultPrefs } from "@/mocks/seed/util"
import type { UserRow } from "@/mocks/types"

// Component tests fake the auth client, not Better-Auth's server. The API owns
// code expiry, throttling and sessions; auth-client.test exercises real HTTP calls.
export const AUTH_TEST_CODE = "246810"
const ok = (data: unknown = { success: true }) => ({ data, error: null })
const fail = (code: string, status = 422, retryAfter?: number) => ({
  data: null,
  error: { code, status, retryAfter },
})
let challenge: UserRow | undefined
const consumedEmails = new Set<string>()
const session = (user: UserRow) => {
  document.cookie = `sy_session=${user.id}; Path=/`
  return ok({ user: { id: user.id }, token: "test-session" })
}

export const authClient = {
  signIn: {
    email: vi.fn(
      async ({ email, password }: { email: string; password: string }) => {
        const user = db.users.find((u) => u.email === email)
        if (!user || user.password !== password)
          return fail("INVALID_EMAIL_OR_PASSWORD", 401)
        if (user.banned) return fail("USER_BANNED", 403)
        if (!user.verifiedEmail) return fail("EMAIL_NOT_VERIFIED", 403)
        if (user.role === "admin") {
          challenge = user
          return ok({ twoFactorRedirect: true })
        }
        return session(user)
      }
    ),
    social: vi.fn(
      async (_body: {
        provider: string
        callbackURL: string
        errorCallbackURL: string
      }) => ok({ redirect: true, url: "https://accounts.example/authorize" })
    ),
  },
  signUp: {
    email: vi.fn(
      async ({
        name,
        email,
        password,
      }: {
        name: string
        email: string
        password: string
      }) => {
        if (db.users.some((u) => u.email === email))
          return fail("USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", 422)
        const user: UserRow = {
          id: newId("u"),
          role: "user",
          fullName: name,
          email,
          password,
          verifiedEmail: false,
          verifiedPhone: false,
          banned: false,
          createdAt: new Date().toISOString(),
          onboardingDone: false,
          interests: [],
          locale: "ar",
          prefs: { ...defaultPrefs },
        }
        db.users.push(user)
        return ok({ user: { id: user.id }, token: null })
      }
    ),
  },
  emailOtp: {
    sendVerificationOtp: vi.fn(
      async (body: { email: string; type: string }) => {
        consumedEmails.delete(body.email)
        return ok()
      }
    ),
    verifyEmail: vi.fn(
      async ({ email, otp }: { email: string; otp: string }) => {
        if (otp !== AUTH_TEST_CODE) return fail("INVALID_OTP")
        if (consumedEmails.has(email)) return fail("OTP_EXPIRED")
        const user = db.users.find((u) => u.email === email)
        if (!user) return fail("OTP_EXPIRED")
        user.verifiedEmail = true
        consumedEmails.add(email)
        return session(user)
      }
    ),
    requestEmailChange: vi.fn(async ({ newEmail }: { newEmail: string }) =>
      db.users.some((u) => u.email === newEmail)
        ? fail("EMAIL_ALREADY_EXISTS", 409)
        : ok()
    ),
    requestPasswordReset: vi.fn(async (_body: { email: string }) => ok()),
    checkVerificationOtp: vi.fn(
      async ({ otp }: { email: string; otp: string; type: string }) =>
        otp === AUTH_TEST_CODE ? ok() : fail("INVALID_OTP")
    ),
    resetPassword: vi.fn(
      async ({
        email,
        otp,
        password,
      }: {
        email: string
        otp: string
        password: string
      }) => {
        if (otp !== AUTH_TEST_CODE) return fail("INVALID_OTP")
        const user = db.users.find((u) => u.email === email)
        if (!user) return fail("OTP_EXPIRED")
        user.password = password
        return ok()
      }
    ),
  },
  twoFactor: {
    sendOtp: vi.fn(async (_body: { trustDevice: boolean }) =>
      challenge ? ok() : fail("INVALID_TWO_FACTOR_COOKIE")
    ),
    verifyOtp: vi.fn(
      async ({ code }: { code: string; trustDevice: boolean }) => {
        if (!challenge) return fail("INVALID_TWO_FACTOR_COOKIE")
        if (code !== AUTH_TEST_CODE) return fail("INVALID_CODE")
        const user = challenge
        challenge = undefined
        return session(user)
      }
    ),
  },
  signOut: vi.fn(async () => {
    document.cookie = "sy_session=; Path=/; Max-Age=0"
    return ok()
  }),
}

export function resetAuthFake() {
  challenge = undefined
  consumedEmails.clear()
  if (typeof document !== "undefined")
    document.cookie = "sy_session=; Path=/; Max-Age=0"
  for (const method of [
    authClient.signOut,
    ...Object.values(authClient.signIn),
    ...Object.values(authClient.signUp),
    ...Object.values(authClient.emailOtp),
    ...Object.values(authClient.twoFactor),
  ])
    method.mockReset()
}
