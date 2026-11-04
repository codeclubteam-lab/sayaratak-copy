import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  adminTableSearchDefaults,
  locationsSearchSchema,
  type LocationsSearch,
} from "@/features/admin/schemas"
import { LocationsPage } from "@/features/admin-locations/components/locations-page"
import { dashboardPage } from "@/features/dashboard/overview-route"

export const Route = createFileRoute("/$locale/admin/locations")({
  validateSearch: locationsSearchSchema,
  search: {
    middlewares: [
      stripSearchParams<LocationsSearch>({
        ...adminTableSearchDefaults,
        tab: "countries",
      }),
    ],
  },
  ...dashboardPage("/admin/locations", "dashboard.nav_locations"),
  component: LocationsPage,
})
