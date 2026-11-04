import { lazyRouteComponent } from "@tanstack/react-router"

import { dashboardPage } from "@/features/dashboard/overview-route"
import { withProps } from "@/lib/lazy-page"
import { dashboardPath } from "@/lib/navigation"
import type { Role } from "@sayaratak/shared/schemas/fields"

const SettingsPage = lazyRouteComponent(
  () => import("./components/settings-page"),
  "SettingsPage"
)

// Route options of the settings page, one per dashboard. The admin's page is `/admin/account`.
export const settingsRoute = (role: Role) => ({
  ...(role === "admin"
    ? dashboardPage("/admin/account", "settings.account_title")
    : dashboardPage(
        `${dashboardPath(role)}/settings`,
        "dashboard.nav_settings"
      )),
  component: withProps(SettingsPage, { role }),
})
