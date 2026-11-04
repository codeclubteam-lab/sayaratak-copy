import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  adminListingsSearchSchema,
  adminTableSearchDefaults,
  type AdminListingsSearch,
} from "@/features/admin/schemas"
import { AdminListingsPage } from "@/features/admin-listings/components/admin-listings-page"
import { dashboardPage } from "@/features/dashboard/overview-route"
import { taxonomyQuery } from "@/features/listings/queries"

const page = dashboardPage("/admin/listings", "dashboard.nav_all_listings")

export const Route = createFileRoute("/$locale/admin/listings")({
  validateSearch: adminListingsSearchSchema,
  search: {
    middlewares: [
      stripSearchParams<AdminListingsSearch>({
        ...adminTableSearchDefaults,
        tab: "all",
        sellerKind: "all",
      }),
    ],
  },
  ...page,
  // The city filter and the sheet's specs read the taxonomy, so it loads first.
  loader: async (args) => {
    const [data] = await Promise.all([
      page.loader(args),
      args.context.queryClient.ensureQueryData(taxonomyQuery),
    ])
    return data
  },
  component: AdminListingsPage,
})
