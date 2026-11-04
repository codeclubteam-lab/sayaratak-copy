import { createFileRoute } from "@tanstack/react-router"

import { newCampaignRoute } from "@/features/ads/ads-routes"

export const Route = createFileRoute("/$locale/workshop/ads/new")(
  newCampaignRoute("workshop")
)
