import { createFileRoute, notFound } from "@tanstack/react-router"

import { taxonomyQuery } from "@/features/listings/queries"
import { SearchPage } from "@/features/search/components/search-page"
import { searchHead } from "@/features/search/head"
import { landingSearch } from "@/features/search/landing"
import { searchLoader } from "@/features/search/loader"
import { fullSearch, routeSearchSchema } from "@sayaratak/shared/search/schemas"
import { useSearchNavigation } from "@/features/search/use-search-navigation"

// One file serves the plain landing and the city landing. The path becomes the same filters as /search, so both render the same page with their own title and canonical.
export const Route = createFileRoute(
  "/$locale/_public/vehicles/$type/$intent/{-$city}"
)({
  validateSearch: routeSearchSchema,
  loaderDeps: ({ search }) => search,
  loader: async ({ context, deps, params, cause }) => {
    const tax = await context.queryClient.ensureQueryData(taxonomyQuery)
    const search = landingSearch(params, fullSearch(deps))
    if (
      !search ||
      (params.city && !tax.cities.some((c) => c.id === params.city))
    )
      throw notFound()
    return searchLoader(context, search, cause)
  },
  head: ({ loaderData, params, match }) => {
    const search = landingSearch(params, fullSearch(match.search))
    return search
      ? searchHead(
          loaderData,
          search,
          `/vehicles/${params.type}/${params.intent}${params.city ? `/${params.city}` : ""}`,
          ["kind", "type", "intent", ...(params.city ? ["city"] : [])]
        )
      : {}
  },
  component: Landing,
})

function Landing() {
  const params = Route.useParams()
  const query = fullSearch(Route.useSearch())
  const search = landingSearch(params, query) ?? query
  const nav = useSearchNavigation(search)
  return <SearchPage search={search} {...nav} />
}
