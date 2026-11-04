import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import { dashboardPage } from "@/features/dashboard/overview-route"
import { NotificationsPage } from "@/features/notifications/components/notifications-page"
import {
  notificationsSearchDefaults,
  notificationsSearchSchema,
} from "@/features/notifications/schemas"

export const Route = createFileRoute("/$locale/account/notifications")({
  validateSearch: notificationsSearchSchema,
  search: { middlewares: [stripSearchParams(notificationsSearchDefaults)] },
  ...dashboardPage("/account/notifications", "dashboard.nav_notifications"),
  component: NotificationsPage,
})
