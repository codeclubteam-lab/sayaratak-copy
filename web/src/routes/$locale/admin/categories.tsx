import { createFileRoute } from "@tanstack/react-router"

import { AdminCategoriesPage } from "@/features/admin-categories/components/categories-page"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/categories")({
  ...dashboardPage("/admin/categories", "dashboard.nav_categories"),
  component: AdminCategoriesPage,
})
