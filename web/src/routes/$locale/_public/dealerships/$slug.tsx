import { createFileRoute } from "@tanstack/react-router"

import { DealershipProfilePage } from "@/features/directory/components/dealership-profile-page"
import { dealershipHead } from "@/features/directory/head"
import { dealershipLoader } from "@/features/directory/loader"
import {
  dealershipProfileRouteSchema,
  dealershipProfileSearchSchema,
} from "@/features/directory/schemas"
import { NotFound } from "@/components/app/not-found"
import { PageSkeleton } from "@/components/app/page-skeleton"

export const Route = createFileRoute("/$locale/_public/dealerships/$slug")({
  validateSearch: dealershipProfileRouteSchema,
  loaderDeps: ({ search }) => search,
  loader: ({ context, params, deps, cause }) =>
    dealershipLoader(
      context,
      params.slug,
      dealershipProfileSearchSchema.parse(deps),
      cause
    ),
  head: ({ loaderData, match }) =>
    dealershipHead(
      loaderData,
      dealershipProfileSearchSchema.parse(match.search)
    ),
  pendingComponent: () => <PageSkeleton variant="detail" />,
  notFoundComponent: NotFound,
  component: Dealership,
})

function Dealership() {
  return (
    <DealershipProfilePage
      slug={Route.useParams().slug}
      search={dealershipProfileSearchSchema.parse(Route.useSearch())}
    />
  )
}
