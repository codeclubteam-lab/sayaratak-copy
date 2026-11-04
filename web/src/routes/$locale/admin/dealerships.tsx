import { createFileRoute } from "@tanstack/react-router"

import { businessesRoute } from "@/features/admin-businesses/businesses-route"

export const Route = createFileRoute("/$locale/admin/dealerships")(
  businessesRoute("dealership")
)
