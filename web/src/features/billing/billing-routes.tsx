import {
  lazyRouteComponent,
  notFound,
  stripSearchParams,
} from "@tanstack/react-router"
import type { QueryClient } from "@tanstack/react-query"

import { dashboardPage } from "@/features/dashboard/overview-route"
import { ApiError } from "@/lib/api/client"
import { withProps } from "@/lib/lazy-page"
import { dashboardPath } from "@/lib/navigation"
import type { Plan } from "@sayaratak/shared/schemas/billing"
import type { Locale } from "@sayaratak/shared/schemas/locale"
import { billingQueries } from "./queries"
import {
  billingSearchDefaults,
  type BillingSearch,
  billingSearchSchema,
  checkoutSearchSchema,
} from "./schemas"

const BillingPage = lazyRouteComponent(
  () => import("./components/billing-page"),
  "BillingPage"
)
const CheckoutPage = lazyRouteComponent(
  () => import("./components/checkout-page"),
  "CheckoutPage"
)
const CheckoutNotFound = lazyRouteComponent(
  () => import("./components/checkout-not-found"),
  "CheckoutNotFound"
)

// Route options of `<dashboard>/billing`, the same for the four roles that pay (the admin has no billing page).
export const billingRoute = (audience: Plan["audience"]) => ({
  validateSearch: billingSearchSchema,
  search: {
    middlewares: [stripSearchParams<BillingSearch>(billingSearchDefaults)],
  },
  ...dashboardPage(
    `${dashboardPath(audience)}/billing`,
    "dashboard.nav_billing"
  ),
  component: withProps(BillingPage, { audience }),
})

// Route options of `<dashboard>/billing/checkout?item=`. The loader awaits the checkout; an item that is unknown, not the user's or already paid is a 404.
export const checkoutRoute = (audience: Plan["audience"]) => {
  const page = dashboardPage(
    `${dashboardPath(audience)}/billing/checkout`,
    "billing.checkout_title"
  )
  return {
    validateSearch: checkoutSearchSchema,
    loaderDeps: ({ search }: { search: { item: string } }) => ({
      item: search.item,
    }),
    loader: async ({
      context,
      deps,
    }: {
      context: { locale: Locale; queryClient: QueryClient }
      deps: { item: string }
    }) => {
      const [data] = await Promise.all([
        page.loader({ context }),
        context.queryClient
          .ensureQueryData({
            ...billingQueries.checkout(deps.item),
            revalidateIfStale: true,
          })
          .catch((error: unknown) => {
            if (
              error instanceof ApiError &&
              [403, 404, 409].includes(error.status)
            )
              throw notFound()
            throw error
          }),
      ])
      return data
    },
    head: page.head,
    notFoundComponent: withProps(CheckoutNotFound, { audience }),
    component: withProps(CheckoutPage, { audience }),
  }
}
