import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  moderationSearchSchema,
  type ModerationSearch,
} from "@/features/admin/schemas"
import { ModerationPage } from "@/features/admin-moderation/components/moderation-page"
import { dashboardPage } from "@/features/dashboard/overview-route"
import { taxonomyQuery } from "@/features/listings/queries"

const page = dashboardPage("/admin/moderation", "dashboard.nav_review_queue")

export const Route = createFileRoute("/$locale/admin/moderation")({
  validateSearch: moderationSearchSchema,
  search: {
    middlewares: [stripSearchParams<ModerationSearch>({ sellerKind: "all" })],
  },
  ...page,
  // Titles and specs are built from the taxonomy, so it loads first.
  loader: async (args) => {
    const [data] = await Promise.all([
      page.loader(args),
      args.context.queryClient.ensureQueryData(taxonomyQuery),
    ])
    return data
  },
  component: ModerationPage,
})
