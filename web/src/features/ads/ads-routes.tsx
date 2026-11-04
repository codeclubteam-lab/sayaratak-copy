import { lazyRouteComponent } from "@tanstack/react-router"

import { dashboardPage } from "@/features/dashboard/overview-route"
import { withProps } from "@/lib/lazy-page"
import { dashboardPath } from "@/lib/navigation"

const AdsPage = lazyRouteComponent(
  () => import("./components/ads-page"),
  "AdsPage"
)
const NewCampaignPage = lazyRouteComponent(
  () => import("./components/new-campaign-page"),
  "NewCampaignPage"
)

type Seller = "dealership" | "workshop" | "mechanic"

// `<dashboard>/ads` and `<dashboard>/ads/new`, the same for the three business roles.
export const adsRoute = (role: Seller) => ({
  ...dashboardPage(`${dashboardPath(role)}/ads`, "dashboard.nav_ads"),
  component: withProps(AdsPage, { role }),
})
export const newCampaignRoute = (role: Seller) => ({
  ...dashboardPage(`${dashboardPath(role)}/ads/new`, "ads.new_title"),
  component: withProps(NewCampaignPage, { role }),
})
