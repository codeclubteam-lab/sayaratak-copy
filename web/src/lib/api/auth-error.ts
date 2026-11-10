import { z } from "zod"

import { ApiError } from "./client"

const bodySchema = z.object({
  status: z.number().optional(),
  code: z.string().optional(),
  fields: z.record(z.string(), z.string()).optional(),
  retryAfter: z.number().optional(),
})
const codes: Record<string, string> = {
  INVALID_EMAIL_OR_PASSWORD: "invalid_credentials",
  INVALID_PASSWORD: "invalid_credentials",
  USER_ALREADY_EXISTS: "exists",
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: "exists",
  EMAIL_ALREADY_EXISTS: "exists",
  USER_BANNED: "banned",
  EMAIL_NOT_VERIFIED: "email_not_verified",
  UNAUTHORIZED: "unauthenticated",
  SESSION_EXPIRED: "unauthenticated",
  INVALID_OTP: "otp_invalid",
  INVALID_CODE: "otp_invalid",
  OTP_EXPIRED: "code_expired",
  OTP_HAS_EXPIRED: "code_expired",
  INVALID_TWO_FACTOR_COOKIE: "code_expired",
  TOO_MANY_ATTEMPTS: "code_expired",
  TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE: "code_expired",
  ACCOUNT_TEMPORARILY_LOCKED: "too_many_attempts",
  TOO_MANY_REQUESTS: "too_many_attempts",
}

// Keep our own 422 fields and throttle data; never show the provider's English message.
export function authError(raw: unknown, retryAfter?: string | null) {
  const body = bodySchema.safeParse(raw).data
  const status = body?.status ?? 500
  const code = body?.code
  const seconds = Number(retryAfter)
  return new ApiError(
    status,
    status === 429
      ? "too_many_attempts"
      : code
        ? (codes[code] ?? code.toLowerCase())
        : "server_error",
    body?.fields,
    body?.retryAfter ?? (seconds > 0 ? seconds : undefined)
  )
}

export async function authCall<T>(
  request: Promise<{ data: T | null; error: unknown }>
): Promise<T> {
  try {
    const result = await request
    if (result.error) throw authError(result.error)
    if (result.data === null) throw new ApiError(500, "server_error")
    return result.data
  } catch (error) {
    if (error instanceof ApiError) throw error
    throw new ApiError(0, "network")
  }
}
