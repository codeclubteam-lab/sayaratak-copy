import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import { dashboardPage } from "@/features/dashboard/overview-route"
import { FavoritesPage } from "@/features/favorites/components/favorites-page"
import {
  favoritesSearchDefaults,
  favoritesSearchSchema,
  type FavoritesSearch,
} from "@/features/favorites/schemas"
import { taxonomyQuery } from "@/features/listings/queries"

const page = dashboardPage("/account/favorites", "dashboard.nav_favorites")

export const Route = createFileRoute("/$locale/account/favorites")({
  validateSearch: favoritesSearchSchema,
  search: {
    middlewares: [stripSearchParams<FavoritesSearch>(favoritesSearchDefaults)],
  },
  ...page,
  // Card titles are built from the taxonomy, so it loads first: no title changes after the cards show.
  loader: async (args) => {
    const [data] = await Promise.all([
      page.loader(args),
      args.context.queryClient.ensureQueryData(taxonomyQuery),
    ])
    return data
  },
  component: FavoritesPage,
})
