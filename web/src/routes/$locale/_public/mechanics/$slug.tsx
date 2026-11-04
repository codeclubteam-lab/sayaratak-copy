import { createFileRoute } from "@tanstack/react-router"

import { NotFound } from "@/components/app/not-found"
import { PageSkeleton } from "@/components/app/page-skeleton"
import { MechanicProfilePage } from "@/features/directory/components/mechanic-profile-page"
import { mechanicHead } from "@/features/directory/mechanic-head"
import { mechanicLoader } from "@/features/directory/mechanic-loader"
import {
  mechanicProfileRouteSchema,
  mechanicProfileSearchSchema,
} from "@/features/directory/mechanic-schemas"

export const Route = createFileRoute("/$locale/_public/mechanics/$slug")({
  validateSearch: mechanicProfileRouteSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps, cause }) =>
    mechanicLoader(
      context,
      params.slug,
      mechanicProfileSearchSchema.parse(deps),
      cause
    ),
  head: ({ loaderData, match }) =>
    mechanicHead(loaderData, mechanicProfileSearchSchema.parse(match.search)),
  pendingComponent: () => <PageSkeleton variant="detail" />,
  notFoundComponent: NotFound,
  component: Mechanic,
})

function Mechanic() {
  return (
    <MechanicProfilePage
      slug={Route.useParams().slug}
      search={mechanicProfileSearchSchema.parse(Route.useSearch())}
    />
  )
}
