import { defaultStringifySearch } from "@tanstack/react-router"

import {
  intentSchema,
  type Intent,
  type VehicleType,
} from "@sayaratak/shared/schemas/listing"
import { TYPE_SLUGS } from "@sayaratak/shared/search/landing"
import { compact, type SearchParams } from "@sayaratak/shared/search/schemas"

export { TYPE_SLUGS }

export const typeSlug = (type: VehicleType) =>
  Object.entries(TYPE_SLUGS).find(([, value]) => value === type)?.[0] ?? "cars"

// Where a search lives: the landing preset its filters name, `/parts` for parts, else `/search`. `search` is what stays in the query string.
export type SearchRoute =
  | {
      to: "landing"
      type: string
      intent: Intent
      city?: string
      search: Partial<SearchParams>
    }
  | { to: "parts" | "search"; search: Partial<SearchParams> }

export function searchRoute(s: SearchParams): SearchRoute {
  const search = compact(s)
  if (s.kind === "part") {
    delete search.kind
    return { to: "parts", search }
  }
  if (s.type && s.intent) {
    for (const k of ["kind", "type", "intent", "city"] as const)
      delete search[k]
    return {
      to: "landing",
      type: typeSlug(s.type),
      intent: s.intent,
      city: s.city,
      search,
    }
  }
  return { to: "search", search }
}

export const routePath = (r: SearchRoute) =>
  r.to === "landing"
    ? `/vehicles/${r.type}/${r.intent}${r.city ? `/${r.city}` : ""}`
    : `/${r.to}`

// A path without the locale and with the query string, for links.
export const routeHref = (r: SearchRoute) =>
  routePath(r) + defaultStringifySearch(r.search)

// The path segments of a landing URL as the filters they stand for. Undefined when the type or intent is unknown (a 404).
export function landingSearch(
  params: { type: string; intent: string; city?: string },
  search: SearchParams
): SearchParams | undefined {
  const type = Object.entries(TYPE_SLUGS).find(
    ([slug]) => slug === params.type
  )?.[1]
  const intent = intentSchema.safeParse(params.intent)
  if (!type || !intent.success) return undefined
  return {
    ...search,
    kind: "vehicle",
    type,
    intent: intent.data,
    city: params.city ?? search.city,
  }
}
