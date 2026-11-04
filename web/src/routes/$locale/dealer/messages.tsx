import { createFileRoute, stripSearchParams } from "@tanstack/react-router"

import { dashboardPage } from "@/features/dashboard/overview-route"
import { MessagesPage } from "@/features/messaging/components/messages-page"
import {
  messagesSearchDefaults,
  messagesSearchSchema,
} from "@/features/messaging/schemas"

export const Route = createFileRoute("/$locale/dealer/messages")({
  validateSearch: messagesSearchSchema,
  search: { middlewares: [stripSearchParams(messagesSearchDefaults)] },
  ...dashboardPage("/dealer/messages", "dashboard.nav_messages"),
  component: () => <MessagesPage labelKey="messages" />,
})
