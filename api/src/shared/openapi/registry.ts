import type { MiddlewareHandler } from "hono"
import type { z } from "zod"

import type { ErrorCode } from "~/shared/http/errors"
import { idempotency } from "~/shared/http/idempotency"

export type RouteSpec = {
  /** One line for the app developer, in the product's words. */
  summary: string
  /** `user` routes need the session cookie or a bearer token (A18). */
  access: "public" | "user"
  /** The success answers, each checked against the code by a B1 test. */
  responses: Partial<Record<200 | 201, z.ZodType>>
  /** Error codes the route can answer. `validation` is added for every route that takes input. */
  errors?: ErrorCode[]
  /** Runs the route once per `Idempotency-Key` (A18). For POSTs that create something. */
  idempotent?: boolean
}

export type InputSpec = {
  target: "json" | "query" | "form"
  schema: z.ZodType
}

// Keyed by the middleware function, so the builder finds each route's spec
// and inputs by walking the Hono router (see build.ts).
const specs = new WeakMap<object, RouteSpec>()
const inputs = new WeakMap<object, InputSpec>()

/**
 * Route middleware that describes a v1 route in openapi.json (A18). At
 * request time it does nothing, or runs `idempotency` when `idempotent` is
 * set. A replay then skips the route's rate limit: a retry of one action is
 * not a second action. Inputs are not repeated here: `validate.*`
 * registers its schema itself, so the contract cannot drift from the code.
 */
export function spec(route: RouteSpec): MiddlewareHandler {
  // A fresh function per route: the WeakMaps are keyed by it.
  const handler: MiddlewareHandler = route.idempotent
    ? (c, next) => idempotency(c, next)
    : (_c, next) => next()
  specs.set(handler, route)
  return handler
}

export function registerInput(handler: object, input: InputSpec) {
  inputs.set(handler, input)
}

export function specOf(handler: object) {
  return specs.get(handler)
}

export function inputOf(handler: object) {
  return inputs.get(handler)
}
