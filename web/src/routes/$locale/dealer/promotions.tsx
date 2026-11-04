import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import { PromotionsPage } from "@/features/billing/components/promotions-page"
import {
  promotionsSearchSchema,
  type PromotionsSearch,
} from "@/features/billing/schemas"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/dealer/promotions")({
  validateSearch: promotionsSearchSchema,
  search: {
    middlewares: [stripSearchParams<PromotionsSearch>({ tab: "active" })],
  },
  ...dashboardPage("/dealer/promotions", "dashboard.nav_promotions"),
  component: PromotionsPage,
})
