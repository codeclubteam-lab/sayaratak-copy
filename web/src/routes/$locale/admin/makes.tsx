import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import { makesSearchSchema } from "@/features/admin/schemas"
import { MakesPage } from "@/features/admin-makes/components/makes-page"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/makes")({
  validateSearch: makesSearchSchema,
  search: { middlewares: [stripSearchParams({})] },
  ...dashboardPage("/admin/makes", "dashboard.nav_makes"),
  component: MakesPage,
})
