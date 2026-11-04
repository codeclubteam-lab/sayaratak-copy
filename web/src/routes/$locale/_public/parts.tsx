import { createFileRoute } from "@tanstack/react-router"

import { SearchPage } from "@/features/search/components/search-page"
import { searchHead } from "@/features/search/head"
import { searchLoader } from "@/features/search/loader"
import { fullSearch, partsRouteSchema } from "@sayaratak/shared/search/schemas"
import { useSearchNavigation } from "@/features/search/use-search-navigation"

export const Route = createFileRoute("/$locale/_public/parts")({
  validateSearch: partsRouteSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps, cause }) =>
    searchLoader(context, fullSearch(deps, "part"), cause),
  head: ({ loaderData, match }) =>
    searchHead(loaderData, fullSearch(match.search, "part"), "/parts", [
      "kind",
    ]),
  component: Parts,
})

function Parts() {
  const search = fullSearch(Route.useSearch(), "part")
  const nav = useSearchNavigation(search)
  return <SearchPage search={search} {...nav} />
}
