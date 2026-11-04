import { createFileRoute } from "@tanstack/react-router"

import { NotFound } from "@/components/app/not-found"
import { PageSkeleton } from "@/components/app/page-skeleton"
import { SitePageView } from "@/features/pages/components/site-page-view"
import { pageHead, pageLoader } from "@/features/pages/loader"

export const Route = createFileRoute("/$locale/_public/privacy")({
  loader: ({ context }) => pageLoader(context, "privacy"),
  head: ({ loaderData }) => pageHead(loaderData),
  pendingComponent: () => <PageSkeleton variant="text" />,
  notFoundComponent: NotFound,
  component: () => <SitePageView slug="privacy" />,
})
