import { createFileRoute, redirect } from "@tanstack/react-router"

import { SearchPage } from "@/features/search/components/search-page"
import { searchHead } from "@/features/search/head"
import { searchRoute } from "@/features/search/landing"
import { searchLoader } from "@/features/search/loader"
import { fullSearch, routeSearchSchema } from "@sayaratak/shared/search/schemas"
import { useSearchNavigation } from "@/features/search/use-search-navigation"

export const Route = createFileRoute("/$locale/_public/search")({
  validateSearch: routeSearchSchema,
  // Part searches live on /parts.
  beforeLoad: ({ search, params }) => {
    if (search.kind === "part")
      throw redirect({
        to: "/$locale/parts",
        params,
        search: searchRoute(fullSearch(search)).search,
      })
  },
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps, cause }) =>
    searchLoader(context, fullSearch(deps), cause),
  head: ({ loaderData, match }) =>
    searchHead(loaderData, fullSearch(match.search), "/search", []),
  component: Search,
})

function Search() {
  const search = fullSearch(Route.useSearch())
  const nav = useSearchNavigation(search)
  return <SearchPage search={search} {...nav} />
}
