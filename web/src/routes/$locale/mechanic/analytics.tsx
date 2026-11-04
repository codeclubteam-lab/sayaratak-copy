import { createFileRoute } from "@tanstack/react-router"

import { analyticsRoute } from "@/features/analytics/analytics-routes"

export const Route = createFileRoute("/$locale/mechanic/analytics")(
  analyticsRoute("mechanic")
)
