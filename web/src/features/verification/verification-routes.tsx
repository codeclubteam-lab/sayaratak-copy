import { lazyRouteComponent } from "@tanstack/react-router"

import { dashboardPage } from "@/features/dashboard/overview-route"
import { withProps } from "@/lib/lazy-page"
import { dashboardPath } from "@/lib/navigation"
import type { TargetType } from "@sayaratak/shared/schemas/review"

const VerificationPage = lazyRouteComponent(
  () => import("./components/verification-page"),
  "VerificationPage"
)

// Route options of `<dashboard>/verification`, the same for the three business roles.
export const verificationRoute = (targetType: TargetType) => ({
  ...dashboardPage(
    `${dashboardPath(targetType)}/verification`,
    "dashboard.nav_verification"
  ),
  component: withProps(VerificationPage, { targetType }),
})
