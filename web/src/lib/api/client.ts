import { z } from "zod"

import { getForwardedCookie } from "./forwarded-cookie"

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly fields?: Record<string, string>,
    readonly retryAfter?: number
  ) {
    super(code)
  }
}

type Query = Record<string, unknown>
const isServer = typeof window === "undefined"

// Arrays repeat the key (`fuel=petrol&fuel=diesel`), undefined and null are dropped.
export function buildUrl(path: string, query?: Query) {
  const base = isServer
    ? (process.env.API_BASE_URL ?? "http://localhost:3000")
    : (import.meta.env.VITE_API_BASE_URL ?? "")
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    for (const v of Array.isArray(value) ? value : [value]) {
      if (v !== undefined && v !== null && v !== "")
        params.append(key, String(v))
    }
  }
  const qs = params.toString()
  return `${base}/api${path}${qs ? `?${qs}` : ""}`
}

const errorBody = z.object({
  code: z.string().optional(),
  fields: z.record(z.string(), z.string()).optional(),
  retryAfter: z.number().optional(),
})
export function errorFrom(status: number, raw: unknown) {
  const body = errorBody.safeParse(raw).data
  return new ApiError(
    status,
    body?.code ?? "server_error",
    body?.fields,
    body?.retryAfter
  )
}
const toApiError = async (res: Response) =>
  errorFrom(res.status, await res.json().catch(() => ({})))

type Options<TSchema extends z.ZodType> = {
  schema: TSchema
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"
  query?: Query
  body?: unknown
  form?: FormData
  signal?: AbortSignal
  keepalive?: boolean
}

export async function apiFetch<TSchema extends z.ZodType>(
  path: string,
  o: Options<TSchema>
): Promise<z.output<TSchema>> {
  const headers = new Headers()
  if (o.body !== undefined) headers.set("content-type", "application/json")
  if (isServer) {
    headers.set("x-mock-ssr", "1")
    const cookie = await getForwardedCookie()
    if (cookie) headers.set("cookie", cookie)
  }
  let res: Response
  try {
    res = await fetch(buildUrl(path, o.query), {
      method: o.method ?? "GET",
      credentials: "include",
      headers,
      body:
        o.form ?? (o.body !== undefined ? JSON.stringify(o.body) : undefined),
      signal: o.signal,
      keepalive: o.keepalive,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError")
      throw error
    throw new ApiError(0, "network")
  }
  if (!res.ok) throw await toApiError(res)
  return o.schema.parse(await res.json())
}
