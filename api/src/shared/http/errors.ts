import type { Context } from "hono"
import type { ContentfulStatusCode } from "hono/utils/http-status"

import { log } from "~/shared/log/logger"

// Handoff "Error codes", plus 500 server_error and the app-only codes of A7.
// The status of a code never changes, so callers name only the code.
const STATUS = {
  unauthenticated: 401,
  invalid_credentials: 401,
  forbidden: 403,
  banned: 403,
  limit_reached: 403,
  not_found: 404,
  exists: 409,
  in_use: 409,
  last_shown: 409,
  payment_pending: 409,
  already_reviewed: 409,
  no_credits: 409,
  bump_wait: 409,
  page_full: 409,
  conflict: 409,
  in_progress: 409,
  code_expired: 410,
  validation: 422,
  otp_invalid: 422,
  invalid_token: 422,
  contact_required: 422,
  idempotency_mismatch: 422,
  upgrade_required: 426,
  too_many_attempts: 429,
  server_error: 500,
} as const satisfies Record<string, ContentfulStatusCode>

export type ErrorCode = keyof typeof STATUS
type CodeWithStatus<S> = {
  [K in ErrorCode]: (typeof STATUS)[K] extends S ? K : never
}[ErrorCode]

export function statusOf(code: ErrorCode) {
  return STATUS[code]
}

/** Field name to i18n key, as the shared schemas write their messages. */
export type ErrorFields = Record<string, string>

export class ApiError extends Error {
  readonly status: ContentfulStatusCode

  constructor(
    readonly code: ErrorCode,
    readonly fields?: ErrorFields,
    readonly retryAfter?: number
  ) {
    super(code)
    this.status = STATUS[code]
  }
}

type Fail = {
  unauthenticated(): never
  invalidCredentials(): never
  forbidden(): never
  banned(): never
  limit(code: CodeWithStatus<403>): never
  notFound(): never
  conflict(code?: CodeWithStatus<409>): never
  gone(code?: CodeWithStatus<410>): never
  validation(fields: ErrorFields): never
  invalid(
    code: Exclude<CodeWithStatus<422>, "validation">,
    fields?: ErrorFields
  ): never
  upgradeRequired(): never
  tooMany(retryAfterSeconds: number): never
}

// Explicitly typed so `if (!row) fail.notFound()` narrows `row` afterwards.
export const fail: Fail = {
  unauthenticated: () => raise("unauthenticated"),
  invalidCredentials: () => raise("invalid_credentials"),
  forbidden: () => raise("forbidden"),
  banned: () => raise("banned"),
  limit: (code) => raise(code),
  notFound: () => raise("not_found"),
  conflict: (code = "conflict") => raise(code),
  gone: (code = "code_expired") => raise(code),
  validation: (fields) => {
    throw new ApiError("validation", fields)
  },
  invalid: (code, fields) => {
    throw new ApiError(code, fields)
  },
  upgradeRequired: () => raise("upgrade_required"),
  tooMany: (retryAfterSeconds) => {
    throw new ApiError("too_many_attempts", undefined, retryAfterSeconds)
  },
}

/** `app.onError`: an ApiError answers with its code; anything else is a 500 that leaks nothing. */
export function onError(error: Error, c: Context) {
  if (error instanceof ApiError) return errorResponse(c, error)
  log.error("server_error", {
    requestId: c.get("requestId"),
    method: c.req.method,
    // The registered pattern, never the raw path: ids, slugs and device tokens stay out of logs (A12).
    route: c.req.routePath,
    error,
  })
  return errorResponse(c, new ApiError("server_error"))
}

/** `app.notFound`: an unknown route reads as a missing resource, as in the mock. */
export function onNotFound(c: Context) {
  return errorResponse(c, new ApiError("not_found"))
}

// `message` repeats the code, as the mock does; the UI reads `code` only.
function errorResponse(c: Context, error: ApiError) {
  const { code, fields, retryAfter } = error
  if (retryAfter !== undefined) c.header("Retry-After", String(retryAfter))
  return c.json(
    {
      code,
      message: code,
      ...(fields && { fields }),
      ...(retryAfter !== undefined && { retryAfter }),
    },
    error.status
  )
}

function raise(code: ErrorCode): never {
  throw new ApiError(code)
}
