import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  adminTableSearchDefaults,
  reportsSearchSchema,
  type ReportsSearch,
} from "@/features/admin/schemas"
import { ReportsPage } from "@/features/admin-reports/components/reports-page"
import { dashboardPage } from "@/features/dashboard/overview-route"
import { taxonomyQuery } from "@/features/listings/queries"

const page = dashboardPage("/admin/reports", "dashboard.nav_reports")

export const Route = createFileRoute("/$locale/admin/reports")({
  validateSearch: reportsSearchSchema,
  search: {
    middlewares: [
      stripSearchParams<ReportsSearch>({
        ...adminTableSearchDefaults,
        tab: "open",
      }),
    ],
  },
  ...page,
  // Listing titles and cities are built from the taxonomy, so it loads first.
  loader: async (args) => {
    const [data] = await Promise.all([
      page.loader(args),
      args.context.queryClient.ensureQueryData(taxonomyQuery),
    ])
    return data
  },
  component: ReportsPage,
})
