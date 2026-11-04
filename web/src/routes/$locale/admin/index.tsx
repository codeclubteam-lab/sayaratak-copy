import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import { AdminOverviewPage } from "@/features/admin-overview/components/admin-overview-page"
import {
  analyticsSearchDefaults,
  analyticsSearchSchema,
  type AnalyticsSearch,
} from "@/features/analytics/schemas"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/")({
  validateSearch: analyticsSearchSchema,
  search: {
    middlewares: [stripSearchParams<AnalyticsSearch>(analyticsSearchDefaults)],
  },
  ...dashboardPage("/admin", "dashboard.nav_overview"),
  component: AdminOverviewPage,
})
