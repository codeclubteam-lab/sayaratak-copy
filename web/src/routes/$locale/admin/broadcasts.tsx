import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  adminTableSearchDefaults,
  adminTableSearchSchema,
  type AdminTableSearch,
} from "@/features/admin/schemas"
import { BroadcastsPage } from "@/features/admin-broadcasts/components/broadcasts-page"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/broadcasts")({
  validateSearch: adminTableSearchSchema,
  search: {
    middlewares: [
      stripSearchParams<AdminTableSearch>(adminTableSearchDefaults),
    ],
  },
  ...dashboardPage("/admin/broadcasts", "dashboard.nav_broadcasts"),
  component: BroadcastsPage,
})
