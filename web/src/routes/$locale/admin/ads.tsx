import { createFileRoute } from "@tanstack/react-router"

import { AdminCampaignsPage } from "@/features/ads/components/admin-campaigns-page"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/ads")({
  ...dashboardPage("/admin/ads", "dashboard.nav_ad_campaigns"),
  component: AdminCampaignsPage,
})
