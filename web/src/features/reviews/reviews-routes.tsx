import { lazyRouteComponent, stripSearchParams } from "@tanstack/react-router"

import { dashboardPage } from "@/features/dashboard/overview-route"
import { withProps } from "@/lib/lazy-page"
import { dashboardPath } from "@/lib/navigation"
import type { TargetType } from "@sayaratak/shared/schemas/review"
import {
  reviewsSearchDefaults,
  reviewsSearchSchema,
  type ReviewsSearch,
} from "./schemas"

const ReviewsManagerPage = lazyRouteComponent(
  () => import("./components/reviews-manager-page"),
  "ReviewsManagerPage"
)

// Route options of `<dashboard>/reviews`, the same for the three business roles.
export const reviewsRoute = (targetType: TargetType) => ({
  validateSearch: reviewsSearchSchema,
  search: {
    middlewares: [stripSearchParams<ReviewsSearch>(reviewsSearchDefaults)],
  },
  ...dashboardPage(
    `${dashboardPath(targetType)}/reviews`,
    "dashboard.nav_reviews"
  ),
  component: withProps(ReviewsManagerPage, { targetType }),
})
