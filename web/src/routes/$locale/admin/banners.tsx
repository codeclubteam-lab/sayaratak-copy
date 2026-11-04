import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  adminTableSearchDefaults,
  adminTableSearchSchema,
  type AdminTableSearch,
} from "@/features/admin/schemas"
import { BannersPage } from "@/features/admin-banners/components/banners-page"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/banners")({
  validateSearch: adminTableSearchSchema,
  search: {
    middlewares: [
      stripSearchParams<AdminTableSearch>(adminTableSearchDefaults),
    ],
  },
  ...dashboardPage("/admin/banners", "dashboard.nav_banners"),
  component: BannersPage,
})
