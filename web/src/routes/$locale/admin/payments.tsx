import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  adminTableSearchDefaults,
  paymentsSearchSchema,
  type PaymentsSearch,
} from "@/features/admin/schemas"
import { PaymentsPage } from "@/features/admin-payments/components/payments-page"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/payments")({
  validateSearch: paymentsSearchSchema,
  search: {
    middlewares: [
      stripSearchParams<PaymentsSearch>({
        ...adminTableSearchDefaults,
        tab: "pending",
      }),
    ],
  },
  ...dashboardPage("/admin/payments", "dashboard.nav_payments"),
  component: PaymentsPage,
})
