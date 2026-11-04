import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  analyticsSearchDefaults,
  analyticsSearchSchema,
  type AnalyticsSearch,
} from "@/features/analytics/schemas"
import { overviewSearchSchema } from "@/features/account-overview/schemas"
import { dashboardPage } from "@/features/dashboard/overview-route"
import { WorkshopOverviewPage } from "@/features/workshop-overview/components/workshop-overview-page"

export const Route = createFileRoute("/$locale/mechanic/")({
  validateSearch: analyticsSearchSchema.extend(overviewSearchSchema.shape),
  search: {
    middlewares: [stripSearchParams<AnalyticsSearch>(analyticsSearchDefaults)],
  },
  ...dashboardPage("/mechanic", "dashboard.nav_overview"),
  component: () => <WorkshopOverviewPage role="mechanic" />,
})
