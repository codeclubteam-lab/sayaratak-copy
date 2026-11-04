import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import {
  adminTableSearchDefaults,
  usersSearchSchema,
  type UsersSearch,
} from "@/features/admin/schemas"
import { UsersPage } from "@/features/admin-users/components/users-page"
import { dashboardPage } from "@/features/dashboard/overview-route"
import { taxonomyQuery } from "@/features/listings/queries"

const page = dashboardPage("/admin/users", "dashboard.nav_users")

export const Route = createFileRoute("/$locale/admin/users")({
  validateSearch: usersSearchSchema,
  search: {
    middlewares: [stripSearchParams<UsersSearch>(adminTableSearchDefaults)],
  },
  ...page,
  // The city column and the sheet read the taxonomy, so it loads first.
  loader: async (args) => {
    const [data] = await Promise.all([
      page.loader(args),
      args.context.queryClient.ensureQueryData(taxonomyQuery),
    ])
    return data
  },
  component: UsersPage,
})
