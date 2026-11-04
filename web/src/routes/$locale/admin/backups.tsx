import { createFileRoute } from "@tanstack/react-router"

import { BackupsPage } from "@/features/admin-backups/components/backups-page"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/backups")({
  ...dashboardPage("/admin/backups", "dashboard.nav_backups"),
  component: BackupsPage,
})
