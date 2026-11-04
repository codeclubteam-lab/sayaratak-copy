import { createFileRoute } from "@tanstack/react-router"

import { checkoutRoute } from "@/features/billing/billing-routes"

export const Route = createFileRoute("/$locale/dealer/billing/checkout")(
  checkoutRoute("dealership")
)
