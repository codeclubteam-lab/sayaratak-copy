import { ZodError } from "zod"

import "./handlers"
import { db } from "./db"
import {
  MockError,
  readCookie,
  routes,
  sessionUser,
  zodFields,
  type Ctx,
} from "./http"

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const errorResponse = (
  status: number,
  code: string,
  fields?: Record<string, string>,
  extra?: Record<string, unknown>
) =>
  Response.json(
    { code, message: code, ...(fields ? { fields } : {}), ...extra },
    { status }
  )

// Dev panel and tests set `x-mock-fail` (header or cookie): 500, 404, 422 or offline.
function injected(req: Request, path: string) {
  if (path.startsWith("/mock")) return null
  const mode = req.headers.get("x-mock-fail") ?? readCookie(req, "mock_fail")
  if (!mode || mode === "none") return null
  if (mode === "404") return errorResponse(404, "not_found")
  if (mode === "422") return errorResponse(422, "validation", {})
  if (mode === "offline") return errorResponse(503, "offline")
  return errorResponse(500, "server_error")
}

// 0 ms for server rendering, then the dev panel value, then MOCK_LATENCY_MS, then 150 to 450 ms.
function latency(req: Request) {
  if (req.headers.get("x-mock-ssr") === "1") return 0
  const fromPanel =
    req.headers.get("x-mock-latency") ?? readCookie(req, "mock_latency")
  const fixed = fromPanel ?? process.env.MOCK_LATENCY_MS
  return fixed !== undefined && fixed !== ""
    ? Number(fixed) || 0
    : 150 + Math.random() * 300
}

export async function handleMock(
  req: Request,
  path?: string
): Promise<Response> {
  const pathname =
    path ?? (new URL(req.url).pathname.replace(/^\/api/, "") || "/")
  const url = new URL(req.url)
  const failure = injected(req, pathname)
  await wait(latency(req))
  if (failure) return failure
  // A timed ban lifts itself on the first request after its end date.
  for (const u of db.users)
    if (u.bannedUntil && Date.parse(u.bannedUntil) <= Date.now())
      Object.assign(u, {
        banned: false,
        bannedReason: undefined,
        bannedUntil: undefined,
      })
  for (const r of routes) {
    const match = r.method === req.method ? r.regex.exec(pathname) : null
    if (!match) continue
    const params = Object.fromEntries(
      r.names.map((n, i) => [n, decodeURIComponent(match[i + 1] ?? "")])
    )
    const ctx: Ctx = {
      req,
      params,
      query: url.searchParams,
      user: sessionUser(req),
      body: async (schema) => {
        const parsed = schema.safeParse(await req.json().catch(() => ({})))
        if (!parsed.success)
          throw new MockError(422, "validation", zodFields(parsed.error))
        return parsed.data
      },
      form: () => req.formData(),
    }
    try {
      const result = await r.handler(ctx)
      return result instanceof Response
        ? result
        : Response.json(result === undefined ? { ok: true } : result)
    } catch (error) {
      if (error instanceof MockError)
        return errorResponse(
          error.status,
          error.code,
          error.fields,
          error.extra
        )
      if (error instanceof ZodError)
        return errorResponse(500, "server_error", undefined, {
          message: `Mock response mismatch: ${error.message}`,
        })
      throw error
    }
  }
  return errorResponse(404, "not_found")
}
