import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  adminTableSearchDefaults,
  adminTableSearchSchema,
  type AdminTableSearch,
} from "@/features/admin/schemas"
import { AdminPromotionsPage } from "@/features/admin-promotions/components/promotions-page"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/promotions")({
  validateSearch: adminTableSearchSchema,
  search: {
    middlewares: [
      stripSearchParams<AdminTableSearch>(adminTableSearchDefaults),
    ],
  },
  ...dashboardPage("/admin/promotions", "dashboard.nav_promotions"),
  component: AdminPromotionsPage,
})
