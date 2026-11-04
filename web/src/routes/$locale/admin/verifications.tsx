import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  adminTableSearchDefaults,
  verificationsSearchSchema,
  type VerificationsSearch,
} from "@/features/admin/schemas"
import { VerificationsPage } from "@/features/admin-verifications/components/verifications-page"
import { dashboardPage } from "@/features/dashboard/overview-route"
import { taxonomyQuery } from "@/features/listings/queries"

const page = dashboardPage(
  "/admin/verifications",
  "dashboard.nav_verifications"
)

export const Route = createFileRoute("/$locale/admin/verifications")({
  validateSearch: verificationsSearchSchema,
  search: {
    middlewares: [
      stripSearchParams<VerificationsSearch>({
        ...adminTableSearchDefaults,
        tab: "pending",
      }),
    ],
  },
  ...page,
  // The sheet names the business's city from the taxonomy, so it loads first.
  loader: async (args) => {
    const [data] = await Promise.all([
      page.loader(args),
      args.context.queryClient.ensureQueryData(taxonomyQuery),
    ])
    return data
  },
  component: VerificationsPage,
})
