import { buildHead } from "@/lib/seo"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import { routePath, searchRoute } from "./landing"
import { compact, type SearchParams } from "@sayaratak/shared/search/schemas"

const presetKeys = ["kind", "intent", "type", "city"]

// A6 indexation. `selfPath` is the page's own path and `held` the params that path already carries. Any other query value (page aside) is `noindex, follow`; when only preset params are extra, the canonical points at the matching landing.
function searchIndexing(s: SearchParams, selfPath: string, held: string[]) {
  // `landingSearch` sets `city: undefined` on a landing without a city; an unset key is not a filter.
  const extra = Object.entries<unknown>(compact(s))
    .filter(([k, v]) => v !== undefined && k !== "page" && !held.includes(k))
    .map(([k]) => k)
  const route = searchRoute(s)
  const preset =
    extra.length > 0 &&
    route.to !== "search" &&
    extra.every((k) => presetKeys.includes(k))
  return {
    noindex: extra.length > 0,
    path: preset
      ? routePath(route)
      : extra.length > 0 || s.page === 1
        ? selfPath
        : `${selfPath}?page=${s.page}`,
  }
}

export function searchHead(
  data: { title: string; description: string; locale: Locale } | undefined,
  s: SearchParams,
  selfPath: string,
  held: string[]
) {
  return data
    ? buildHead({ ...data, ...searchIndexing(s, selfPath, held) })
    : { meta: [], links: [] }
}
