import { createFileRoute } from "@tanstack/react-router"

import { DealershipsPage } from "@/features/directory/components/dealerships-page"
import { dealershipsHead } from "@/features/directory/head"
import { dealershipsLoader } from "@/features/directory/loader"
import {
  dealershipRouteSchema,
  dealershipSearchSchema,
} from "@/features/directory/schemas"
import { useDealershipNavigation } from "@/features/directory/use-dealership-navigation"

export const Route = createFileRoute("/$locale/_public/dealerships/")({
  validateSearch: dealershipRouteSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps, cause }) =>
    dealershipsLoader(context, dealershipSearchSchema.parse(deps), cause),
  head: ({ loaderData, match }) =>
    dealershipsHead(loaderData, dealershipSearchSchema.parse(match.search)),
  component: Dealerships,
})

function Dealerships() {
  const search = dealershipSearchSchema.parse(Route.useSearch())
  const nav = useDealershipNavigation(search)
  return <DealershipsPage search={search} {...nav} />
}
