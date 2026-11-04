// Shared helpers of `bun run seo:check` (scripts/check-seo.ts, scripts/check-seo-policy.ts).
import process from "node:process"

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
// `as` signs in a mock role: the session cookie holds a seed user id (src/mocks/db.ts).
export const get = (path: string, init: RequestInit & { as?: string } = {}) =>
  fetch(base + path, {
    ...init,
    headers: init.as ? { cookie: `sy_session=${init.as}` } : undefined,
  })
export const getJson = async <T>(path: string, as?: string) =>
  (await (await get(path, { as })).json()) as T

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
