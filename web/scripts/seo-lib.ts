// Shared helpers of `bun run seo:check` (scripts/check-seo.ts, scripts/check-seo-policy.ts).
import process from "node:process"

import { apiBase } from "../e2e/auth"

export const base = (
  process.argv[2] ??
  process.env.SEO_ORIGIN ??
  process.env.APP_ORIGIN ??
  "http://localhost:3000"
).replace(/\/$/, "")

export const result = { failed: 0 }
export const check = (ok: boolean, what: string) => {
  if (!ok) {
    result.failed++
    console.log(`FAIL ${what}`)
  }
}

export const get = (
  path: string,
  init: RequestInit & { cookie?: string } = {}
) => {
  const { cookie, headers, ...rest } = init
  return fetch(base + path, {
    ...rest,
    headers: cookie ? { ...headers, cookie } : headers,
  })
}

export const apiRequest = (
  path: string,
  init: RequestInit & { cookie?: string } = {}
) => {
  const { cookie, headers, ...rest } = init
  return fetch(`${apiBase}/api/v1${path}`, {
    ...rest,
    headers: {
      ...(rest.body ? { "content-type": "application/json" } : {}),
      origin: base,
      ...(cookie ? { cookie } : {}),
      ...headers,
    },
  })
}

export const getApiJson = async <T>(path: string, cookie?: string) => {
  const res = await apiRequest(path, { cookie })
  if (!res.ok) throw new Error(`GET /api/v1${path} failed: ${res.status}`)
  return (await res.json()) as T
}

export const unescape = (s: string) =>
  s
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")

export const pathOf = (href?: string | null) =>
  decodeURI(href ?? "").replace(/^https?:\/\/[^/]+/, "")

export type Tag = Record<string, string>
export const tagsOf = (html: string) =>
  [...html.matchAll(/<(meta|link)\b([^>]*)>/g)].map((m) => {
    const tag: Tag = { tag: m[1]! }
    for (const a of m[2]!.matchAll(/([\w:-]+)="([^"]*)"/g))
      tag[a[1]!.toLowerCase()] = unescape(a[2]!)
    return tag
  })
export const robotsOf = (tags: Tag[]) =>
  tags.find((t) => t.name === "robots")?.content
export const canonicalOf = (tags: Tag[]) =>
  pathOf(tags.find((t) => t.rel === "canonical")?.href)
