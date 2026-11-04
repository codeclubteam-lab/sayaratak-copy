import { lazyRouteComponent, stripSearchParams } from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"

import {
  adminTableSearchDefaults,
  businessesSearchSchema,
  type BusinessesSearch,
} from "@/features/admin/schemas"
import { dashboardPage } from "@/features/dashboard/overview-route"
import { taxonomyQuery } from "@/features/listings/queries"
import { adminQueries } from "@/features/admin/queries"
import { withProps } from "@/lib/lazy-page"
import type { AdminBusiness } from "@sayaratak/shared/schemas/admin"
import type { Locale } from "@sayaratak/shared/schemas/locale"

const BusinessesPage = lazyRouteComponent(
  () => import("./components/businesses-page"),
  "BusinessesPage"
)

// Route options of `/admin/dealerships`, `/admin/workshops` and `/admin/mechanics`. The city column and the plan filter read the taxonomy and the plans, so both load first.
export const businessesRoute = (type: AdminBusiness["type"]) => {
  const page = dashboardPage(`/admin/${type}s`, `dashboard.nav_${type}s`)
  return {
    validateSearch: businessesSearchSchema,
    search: {
      middlewares: [
        stripSearchParams<BusinessesSearch>(adminTableSearchDefaults),
      ],
    },
    ...page,
    loader: async (args: {
      context: { locale: Locale; queryClient: QueryClient }
    }) => {
      const [data] = await Promise.all([
        page.loader(args),
        args.context.queryClient.ensureQueryData(taxonomyQuery),
        args.context.queryClient.ensureQueryData(adminQueries.plans),
      ])
      return data
    },
    component: withProps(BusinessesPage, { type }),
  }
}
