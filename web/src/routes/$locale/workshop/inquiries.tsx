import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import { dashboardPage } from "@/features/dashboard/overview-route"
import { MessagesPage } from "@/features/messaging/components/messages-page"
import {
  messagesSearchDefaults,
  messagesSearchSchema,
} from "@/features/messaging/schemas"

export const Route = createFileRoute("/$locale/workshop/inquiries")({
  validateSearch: messagesSearchSchema,
  search: { middlewares: [stripSearchParams(messagesSearchDefaults)] },
  ...dashboardPage("/workshop/inquiries", "dashboard.nav_inquiries"),
  component: () => <MessagesPage labelKey="inquiries" />,
})
