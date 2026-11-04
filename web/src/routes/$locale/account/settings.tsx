import { createFileRoute } from "@tanstack/react-router"

import { settingsRoute } from "@/features/settings/settings-routes"

export const Route = createFileRoute("/$locale/account/settings")(
  settingsRoute("user")
)
