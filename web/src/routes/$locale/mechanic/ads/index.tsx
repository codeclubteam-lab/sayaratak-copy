import { createFileRoute } from "@tanstack/react-router"

import { adsRoute } from "@/features/ads/ads-routes"

export const Route = createFileRoute("/$locale/mechanic/ads/")(
  adsRoute("mechanic")
)
