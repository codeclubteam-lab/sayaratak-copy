import { createFileRoute } from "@tanstack/react-router"

import { dashboardPage } from "@/features/dashboard/overview-route"
import { PhotosPage } from "@/features/workshop-photos/components/photos-page"

export const Route = createFileRoute("/$locale/workshop/photos")({
  ...dashboardPage("/workshop/photos", "dashboard.nav_photos"),
  component: PhotosPage,
})
