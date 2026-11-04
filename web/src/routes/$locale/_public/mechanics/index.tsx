import { createFileRoute } from "@tanstack/react-router"

import { MechanicsPage } from "@/features/directory/components/mechanics-page"
import { mechanicsHead } from "@/features/directory/mechanic-head"
import { mechanicsLoader } from "@/features/directory/mechanic-loader"
import {
  mechanicRouteSchema,
  mechanicSearchSchema,
} from "@/features/directory/mechanic-schemas"
import { useMechanicNavigation } from "@/features/directory/use-mechanic-navigation"

export const Route = createFileRoute("/$locale/_public/mechanics/")({
  validateSearch: mechanicRouteSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps, cause }) =>
    mechanicsLoader(context, mechanicSearchSchema.parse(deps), cause),
  head: ({ loaderData, match }) =>
    mechanicsHead(loaderData, mechanicSearchSchema.parse(match.search)),
  component: Mechanics,
})

function Mechanics() {
  const search = mechanicSearchSchema.parse(Route.useSearch())
  const nav = useMechanicNavigation(search)
  return <MechanicsPage search={search} {...nav} />
}
