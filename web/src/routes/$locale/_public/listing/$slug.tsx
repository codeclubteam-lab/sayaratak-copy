import { createFileRoute } from "@tanstack/react-router"

import { ListingDetailPage } from "@/features/listings/components/listing-detail-page"
import { listingLoader } from "@/features/listings/detail-loader"
import { buildHead } from "@/lib/seo"
import { NotFound } from "@/components/app/not-found"
import { PageSkeleton } from "@/components/app/page-skeleton"

export const Route = createFileRoute("/$locale/_public/listing/$slug")({
  loader: ({ context, params }) => listingLoader(context, params.slug),
  head: ({ loaderData }) =>
    loaderData
      ? buildHead({ ...loaderData, path: `/listing/${loaderData.slug}` })
      : {},
  pendingComponent: () => <PageSkeleton variant="detail" />,
  notFoundComponent: NotFound,
  component: Listing,
})

function Listing() {
  return <ListingDetailPage slug={Route.useParams().slug} />
}
