import { createFileRoute } from "@tanstack/react-router"

import { NotFound } from "@/components/app/not-found"
import { PageSkeleton } from "@/components/app/page-skeleton"
import { ContactDetails } from "@/features/pages/components/contact-details"
import { ContactForm } from "@/features/pages/components/contact-form"
import { SitePageView } from "@/features/pages/components/site-page-view"
import { pageHead, pageLoader } from "@/features/pages/loader"
import { siteQuery } from "@/features/pages/queries"

export const Route = createFileRoute("/$locale/_public/contact")({
  loader: async ({ context }) => {
    const [data] = await Promise.all([
      pageLoader(context, "contact"),
      context.queryClient.prefetchQuery(siteQuery),
    ])
    return data
  },
  head: ({ loaderData }) => pageHead(loaderData),
  pendingComponent: () => <PageSkeleton variant="text" />,
  notFoundComponent: NotFound,
  component: () => (
    <SitePageView slug="contact">
      <ContactForm />
      <ContactDetails />
    </SitePageView>
  ),
})
