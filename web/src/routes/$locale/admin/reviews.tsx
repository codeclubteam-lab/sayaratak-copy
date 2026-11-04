import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  adminTableSearchDefaults,
  reviewsSearchSchema,
  type ReviewsSearch,
} from "@/features/admin/schemas"
import { ReviewsPage } from "@/features/admin-reviews/components/reviews-page"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/reviews")({
  validateSearch: reviewsSearchSchema,
  search: {
    middlewares: [
      stripSearchParams<ReviewsSearch>({
        ...adminTableSearchDefaults,
        tab: "flagged",
      }),
    ],
  },
  ...dashboardPage("/admin/reviews", "dashboard.nav_reviews"),
  component: ReviewsPage,
})
