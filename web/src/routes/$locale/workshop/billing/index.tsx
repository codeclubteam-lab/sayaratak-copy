import { createFileRoute } from "@tanstack/react-router"

import { billingRoute } from "@/features/billing/billing-routes"

export const Route = createFileRoute("/$locale/workshop/billing/")(
  billingRoute("workshop")
)
