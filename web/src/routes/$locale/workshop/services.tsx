import { createFileRoute } from "@tanstack/react-router"

import { dashboardPage } from "@/features/dashboard/overview-route"
import { taxonomyQuery } from "@/features/listings/queries"
import { ServicesPage } from "@/features/workshop-services/components/services-page"

const page = dashboardPage("/workshop/services", "dashboard.nav_services")

export const Route = createFileRoute("/$locale/workshop/services")({
  ...page,
  // Template names come from the taxonomy, so it loads with the page.
  loader: async (args) => {
    const [data] = await Promise.all([
      page.loader(args),
      args.context.queryClient.ensureQueryData(taxonomyQuery),
    ])
    return data
  },
  component: ServicesPage,
})
