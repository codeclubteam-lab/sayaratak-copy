import { createFileRoute } from "@tanstack/react-router"

import { WorkshopsPage } from "@/features/directory/components/workshops-page"
import { useWorkshopNavigation } from "@/features/directory/use-workshop-navigation"
import { workshopsHead } from "@/features/directory/workshop-head"
import { workshopsLoader } from "@/features/directory/workshop-loader"
import {
  workshopRouteSchema,
  workshopSearchSchema,
} from "@/features/directory/workshop-schemas"

export const Route = createFileRoute("/$locale/_public/workshops/")({
  validateSearch: workshopRouteSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps, cause }) =>
    workshopsLoader(context, workshopSearchSchema.parse(deps), cause),
  head: ({ loaderData, match }) =>
    workshopsHead(loaderData, workshopSearchSchema.parse(match.search)),
  component: Workshops,
})

function Workshops() {
  const search = workshopSearchSchema.parse(Route.useSearch())
  const nav = useWorkshopNavigation(search)
  return <WorkshopsPage search={search} {...nav} />
}
