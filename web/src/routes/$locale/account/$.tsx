import { createFileRoute } from "@tanstack/react-router"

import { DashboardNotFound } from "@/features/dashboard/components/dashboard-not-found"
import { dashboardPage } from "@/features/dashboard/overview-route"

// An unknown path under /account. The router's own not-found goes to the root, which would drop the sidebar; the splat keeps it.
export const Route = createFileRoute("/$locale/account/$")({
  ...dashboardPage("/account", "error.not_found_title"),
  component: DashboardNotFound,
})
