import { createFileRoute } from "@tanstack/react-router"

import { SiteSettingsPage } from "@/features/admin-settings/components/site-settings-page"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/settings")({
  ...dashboardPage("/admin/settings", "dashboard.nav_settings"),
  component: SiteSettingsPage,
})
