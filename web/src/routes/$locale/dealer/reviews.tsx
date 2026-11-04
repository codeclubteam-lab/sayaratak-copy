import { createFileRoute } from "@tanstack/react-router"

import { reviewsRoute } from "@/features/reviews/reviews-routes"

export const Route = createFileRoute("/$locale/dealer/reviews")(
  reviewsRoute("dealership")
)
