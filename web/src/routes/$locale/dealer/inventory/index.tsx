import { useCallback } from "react"
import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import { dashboardPage } from "@/features/dashboard/overview-route"
import { ListingsManager } from "@/features/listings-manager/components/listings-manager"
import {
  listingsManagerSearchSchema,
  managerSearchDefaults,
  type PrunedSearch,
} from "@/features/listings-manager/schemas"

export const Route = createFileRoute("/$locale/dealer/inventory/")({
  validateSearch: listingsManagerSearchSchema,
  search: { middlewares: [stripSearchParams(managerSearchDefaults)] },
  ...dashboardPage("/dealer/inventory", "dashboard.nav_inventory"),
  component: function Inventory() {
    const search = Route.useSearch()
    const navigate = Route.useNavigate()
    const onNavigate = useCallback(
      (next: PrunedSearch, replace: boolean) =>
        void navigate({
          search: next,
          replace,
          resetScroll: false,
          viewTransition: false,
        }),
      [navigate]
    )
    return (
      <ListingsManager scope="dealer" search={search} onNavigate={onNavigate} />
    )
  },
})
