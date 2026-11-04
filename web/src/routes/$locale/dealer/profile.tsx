import { createFileRoute } from "@tanstack/react-router"

import { BusinessProfilePage } from "@/features/business-profile/components/business-profile-page"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/dealer/profile")({
  ...dashboardPage("/dealer/profile", "dashboard.nav_profile"),
  component: () => <BusinessProfilePage variant="dealership" />,
})
