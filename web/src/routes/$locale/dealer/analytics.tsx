import { createFileRoute } from "@tanstack/react-router"

import { analyticsRoute } from "@/features/analytics/analytics-routes"

export const Route = createFileRoute("/$locale/dealer/analytics")(
  analyticsRoute("dealership")
)
