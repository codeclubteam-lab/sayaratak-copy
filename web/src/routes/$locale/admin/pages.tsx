import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import { PagesAdminPage } from "@/features/admin-pages/components/pages-admin-page"
import {
  pagesSearchSchema,
  type PagesSearch,
} from "@/features/admin-pages/schemas"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/pages")({
  validateSearch: pagesSearchSchema,
  search: {
    middlewares: [stripSearchParams<PagesSearch>({ page: "about" })],
  },
  ...dashboardPage("/admin/pages", "dashboard.nav_pages"),
  component: PagesAdminPage,
})
