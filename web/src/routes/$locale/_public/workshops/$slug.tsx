import { createFileRoute } from "@tanstack/react-router"

import { NotFound } from "@/components/app/not-found"
import { PageSkeleton } from "@/components/app/page-skeleton"
import { WorkshopProfilePage } from "@/features/directory/components/workshop-profile-page"
import { workshopHead } from "@/features/directory/workshop-head"
import { workshopLoader } from "@/features/directory/workshop-loader"
import {
  workshopProfileRouteSchema,
  workshopProfileSearchSchema,
} from "@/features/directory/workshop-schemas"

export const Route = createFileRoute("/$locale/_public/workshops/$slug")({
  validateSearch: workshopProfileRouteSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps, cause }) =>
    workshopLoader(
      context,
      params.slug,
      workshopProfileSearchSchema.parse(deps),
      cause
    ),
  head: ({ loaderData, match }) =>
    workshopHead(loaderData, workshopProfileSearchSchema.parse(match.search)),
  pendingComponent: () => <PageSkeleton variant="detail" />,
  notFoundComponent: NotFound,
  component: Workshop,
})

function Workshop() {
  return (
    <WorkshopProfilePage
      slug={Route.useParams().slug}
      search={workshopProfileSearchSchema.parse(Route.useSearch())}
    />
  )
}
