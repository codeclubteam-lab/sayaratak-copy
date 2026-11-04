import { createFileRoute } from "@tanstack/react-router"

import { AccountOverviewPage } from "@/features/account-overview/components/account-overview-page"
import { overviewSearchSchema } from "@/features/account-overview/schemas"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/account/")({
  validateSearch: overviewSearchSchema,
  ...dashboardPage("/account", "dashboard.nav_overview"),
  component: AccountOverviewPage,
})
