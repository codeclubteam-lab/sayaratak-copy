import type { z, ZodError } from "zod"

import { db, find } from "./db"
import type { UserRow } from "./types"

export type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
export type Ctx = {
  req: Request
  params: Record<string, string>
  query: URLSearchParams
  user: UserRow | null
  body: <TSchema extends z.ZodType>(
    schema: TSchema
  ) => Promise<z.output<TSchema>>
  form: Request["formData"]
}
type Handler = (c: Ctx) => unknown

export class MockError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fields?: Record<string, string>,
    readonly extra?: Record<string, unknown>
  ) {
    super(code)
  }
}
// `throw fail(404, "not_found")`; codes come from the table in A12.
export const fail = (
  status: number,
  code: string,
  fields?: Record<string, string>,
  extra?: Record<string, unknown>
) => new MockError(status, code, fields, extra)

type Compiled = {
  method: Method
  regex: RegExp
  names: string[]
  handler: Handler
}
export const routes: Compiled[] = []
export function route(method: Method, pattern: string, handler: Handler) {
  const names: string[] = []
  const source = pattern.replace(/:(\w+)/g, (_, name: string) => {
    names.push(name)
    return "([^/]+)"
  })
  routes.push({ method, regex: new RegExp(`^${source}$`), names, handler })
}

export const SESSION_COOKIE = "sy_session"
export const readCookie = (req: Request, name: string) => {
  const raw = req.headers.get("cookie") ?? ""
  for (const part of raw.split(";")) {
    const [key, ...rest] = part.trim().split("=")
    if (key === name) return decodeURIComponent(rest.join("="))
  }
  return undefined
}
export const sessionUser = (req: Request) => {
  const id = readCookie(req, SESSION_COOKIE)
  return id ? (find(db.users, id) ?? null) : null
}
export const sessionHeader = (userId: string | null) =>
  `${SESSION_COOKIE}=${userId ?? ""}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${userId ? 60 * 60 * 24 * 30 : 0}${process.env.NODE_ENV === "production" ? "; Secure" : ""}`
// Sign in or out: the body plus a Set-Cookie header.
export const withSession = (
  userId: string | null,
  data: unknown,
  status = 200
) =>
  Response.json(data, {
    status,
    headers: { "set-cookie": sessionHeader(userId) },
  })

export const needUser = (c: Ctx) => {
  if (!c.user) throw fail(401, "unauthenticated")
  if (c.user.banned) throw fail(403, "banned")
  return c.user
}
export const needRole = (c: Ctx, ...roles: UserRow["role"][]) => {
  const user = needUser(c)
  if (!roles.includes(user.role)) throw fail(403, "forbidden")
  return user
}

// Zod issues become `fields`; only i18n keys pass through, anything else reads as "required".
export const zodFields = (error: ZodError) => {
  const fields: Record<string, string> = {}
  for (const issue of error.issues) {
    const name = issue.path.join(".") || "_"
    fields[name] ??= issue.message.startsWith("validation.")
      ? issue.message
      : "validation.required"
  }
  return fields
}

// Query strings to a plain object: repeated keys and `arrayKeys` become arrays, "true" and "false" become booleans.
export function queryObject(query: URLSearchParams, arrayKeys: string[] = []) {
  const out: Record<string, unknown> = {}
  for (const key of new Set(query.keys())) {
    const all = query
      .getAll(key)
      .map((v) => (v === "true" ? true : v === "false" ? false : v))
    out[key] = all.length > 1 || arrayKeys.includes(key) ? all : all[0]
  }
  return out
}
// `limit` (1 to 24) is for rails and short lists, `pageSize` (up to `maxSize`) for whole pages and exports.
export const pageParams = (
  query: URLSearchParams,
  defaultSize = 20,
  maxSize = 100
) => {
  const limit = Number(query.get("limit"))
  return {
    page: Math.max(1, Number(query.get("page")) || 1),
    pageSize: limit
      ? Math.min(24, Math.max(1, Math.floor(limit)))
      : Math.min(maxSize, Number(query.get("pageSize")) || defaultSize),
  }
}
export const ok = { ok: true } as const
