import { createFileRoute } from "@tanstack/react-router"

import { AdPricesPage } from "@/features/ads/components/ad-prices-page"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/ad-prices")({
  ...dashboardPage("/admin/ad-prices", "dashboard.nav_ad_prices"),
  component: AdPricesPage,
})
