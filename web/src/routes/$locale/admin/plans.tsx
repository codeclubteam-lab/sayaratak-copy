import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  adminTableSearchDefaults,
  plansSearchSchema,
  type PlansSearch,
} from "@/features/admin/schemas"
import { PlansPage } from "@/features/admin-plans/components/plans-page"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/plans")({
  validateSearch: plansSearchSchema,
  search: {
    middlewares: [
      stripSearchParams<PlansSearch>({
        ...adminTableSearchDefaults,
        tab: "user",
      }),
    ],
  },
  ...dashboardPage("/admin/plans", "dashboard.nav_plans"),
  component: PlansPage,
})
