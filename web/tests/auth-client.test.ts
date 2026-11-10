import { afterEach, describe, expect, it, vi } from "vitest"

import { authClient } from "@/lib/auth-client"
import { authCall, authError } from "@/lib/api/auth-error"

vi.unmock("@/lib/auth-client")
afterEach(() => vi.unstubAllGlobals())

function reply(body: unknown, status = 200, headers?: HeadersInit) {
  const fetch = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
    Response.json(body, { status, headers })
  )
  vi.stubGlobal("fetch", fetch)
  return fetch
}
const lastRequest = (fetch: ReturnType<typeof reply>) => ({
  ...fetch.mock.lastCall?.[1],
  url: String(fetch.mock.lastCall?.[0]),
})

describe("Better-Auth transport", () => {
  it("sends credentials to /api/v1/auth and keeps two-factor challenges distinct", async () => {
    const fetch = reply({ twoFactorRedirect: true })
    const result = await authCall(
      authClient.signIn.email({ email: "admin@demo.sy", password: "Demo1234" })
    )
    expect(result).toEqual({ twoFactorRedirect: true })
    expect(lastRequest(fetch)).toMatchObject({
      url: expect.stringMatching(/\/api\/v1\/auth\/sign-in\/email$/),
      credentials: "include",
      method: "POST",
    })
  })
  it("uses Better-Auth's name field and never signs up through the mock endpoint", async () => {
    const fetch = reply({ user: { id: "new-user" }, token: null })
    await authCall(
      authClient.signUp.email({
        name: "New Person",
        email: "new@example.com",
        password: "Passw0rd1",
      })
    )
    expect(lastRequest(fetch)).toMatchObject({
      url: expect.stringMatching(/\/sign-up\/email$/),
      body: JSON.stringify({
        name: "New Person",
        email: "new@example.com",
        password: "Passw0rd1",
      }),
    })
  })
  it("checks a reset code without a token and submits email, code and new password together", async () => {
    const fetch = reply({ success: true })
    await authCall(
      authClient.emailOtp.checkVerificationOtp({
        email: "a@example.com",
        otp: "246810",
        type: "forget-password",
      })
    )
    expect(lastRequest(fetch)).toMatchObject({
      url: expect.stringMatching(/\/email-otp\/check-verification-otp$/),
      method: "POST",
    })
    await authCall(
      authClient.emailOtp.resetPassword({
        email: "a@example.com",
        otp: "246810",
        password: "Newpass123",
      })
    )
    expect(lastRequest(fetch)).toMatchObject({
      url: expect.stringMatching(/\/email-otp\/reset-password$/),
      body: JSON.stringify({
        email: "a@example.com",
        otp: "246810",
        password: "Newpass123",
      }),
    })
  })
  it("sends and checks an admin code without trusting the device", async () => {
    const fetch = reply({ status: true })
    await authCall(authClient.twoFactor.sendOtp({ trustDevice: false }))
    expect(lastRequest(fetch)).toMatchObject({
      url: expect.stringMatching(/\/two-factor\/send-otp$/),
      body: JSON.stringify({ trustDevice: false }),
    })
    await authCall(
      authClient.twoFactor.verifyOtp({ code: "246810", trustDevice: false })
    )
    expect(lastRequest(fetch)).toMatchObject({
      url: expect.stringMatching(/\/two-factor\/verify-otp$/),
      body: JSON.stringify({ code: "246810", trustDevice: false }),
    })
  })
  it("preserves validation fields and Retry-After from the response", async () => {
    reply(
      { code: "validation", fields: { password: "validation.password_weak" } },
      422
    )
    await expect(
      authCall(
        authClient.signIn.email({ email: "a@example.com", password: "bad" })
      )
    ).rejects.toMatchObject({
      status: 422,
      code: "validation",
      fields: { password: "validation.password_weak" },
    })
    reply({ message: "Too many requests" }, 429, { "retry-after": "41" })
    await expect(
      authCall(
        authClient.twoFactor.verifyOtp({ code: "000000", trustDevice: false })
      )
    ).rejects.toMatchObject({
      status: 429,
      code: "too_many_attempts",
      retryAfter: 41,
    })
  })
  it("maps HTTP errors and network failures into ApiError", async () => {
    reply(
      {
        code: "INVALID_EMAIL_OR_PASSWORD",
        message: "Provider text must not reach the UI",
      },
      401
    )
    await expect(
      authCall(
        authClient.signIn.email({ email: "a@example.com", password: "bad" })
      )
    ).rejects.toMatchObject({
      status: 401,
      code: "invalid_credentials",
      message: "invalid_credentials",
    })
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")))
    await expect(authCall(authClient.signOut())).rejects.toMatchObject({
      status: 0,
      code: "network",
    })
  })
})

describe("auth error mapping", () => {
  it.each([
    ["INVALID_OTP", "otp_invalid"],
    ["INVALID_CODE", "otp_invalid"],
    ["OTP_EXPIRED", "code_expired"],
    ["OTP_HAS_EXPIRED", "code_expired"],
    ["TOO_MANY_ATTEMPTS", "code_expired"],
    ["INVALID_TWO_FACTOR_COOKIE", "code_expired"],
    ["USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL", "exists"],
    ["EMAIL_ALREADY_EXISTS", "exists"],
    ["USER_BANNED", "banned"],
    ["EMAIL_NOT_VERIFIED", "email_not_verified"],
    ["UNAUTHORIZED", "unauthenticated"],
    ["SESSION_EXPIRED", "unauthenticated"],
    ["ACCOUNT_TEMPORARILY_LOCKED", "too_many_attempts"],
  ])("maps %s to %s", (code, expected) => {
    expect(authError({ status: 422, code }).code).toBe(expected)
  })
})
