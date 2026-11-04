import { createFileRoute } from "@tanstack/react-router"

import { getShellCopy } from "@/lib/i18n/server"
import { buildHead } from "@/lib/seo"
import { countsQuery } from "@/features/notifications/counts-query"
import { siteQuery } from "@/features/pages/queries"
import { PublicLayout } from "@/components/app/public-layout"

export const Route = createFileRoute("/$locale/_public")({
  loader: async ({ context, location }) => {
    const [copy] = await Promise.all([
      getShellCopy({ data: context.locale }),
      context.queryClient.ensureQueryData(siteQuery).catch(() => null),
      context.me
        ? context.queryClient.ensureQueryData(countsQuery).catch(() => null)
        : null,
    ])
    return { ...copy, path: location.pathname, locale: context.locale }
  },
  // Meta only: head tags of the matched routes are all kept, so a layout canonical next to a page's own would give two. Every page route sets its own canonical and hreflang.
  head: ({ loaderData }) =>
    loaderData ? { meta: buildHead(loaderData).meta } : {},
  component: PublicLayout,
})
