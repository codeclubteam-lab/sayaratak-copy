import { createFileRoute } from "@tanstack/react-router"

import { dashboardPage } from "@/features/dashboard/overview-route"
import { taxonomyQuery } from "@/features/listings/queries"
import { SavedSearchesPage } from "@/features/saved-searches/components/saved-searches-page"

const page = dashboardPage(
  "/account/saved-searches",
  "dashboard.nav_saved_searches"
)

export const Route = createFileRoute("/$locale/account/saved-searches")({
  ...page,
  // Filter chips are named from the taxonomy, so it loads first: no chip changes from an id to a name.
  loader: async (args) => {
    const [data] = await Promise.all([
      page.loader(args),
      args.context.queryClient.ensureQueryData(taxonomyQuery),
    ])
    return data
  },
  component: SavedSearchesPage,
})
