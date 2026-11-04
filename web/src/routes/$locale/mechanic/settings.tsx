import { createFileRoute } from "@tanstack/react-router"

import { settingsRoute } from "@/features/settings/settings-routes"

export const Route = createFileRoute("/$locale/mechanic/settings")(
  settingsRoute("mechanic")
)
