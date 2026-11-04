import { useNavigate } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import {
  workshopProfileRouteSchema,
  type WorkshopProfileSearch,
} from "./workshop-schemas"

// The tab lives in the URL. Replace, no scroll reset, no view transition.
export function useWorkshopProfileNavigation(slug: string) {
  const navigate = useNavigate()
  const { locale } = useT()
  return (tab: WorkshopProfileSearch["tab"]) =>
    navigate({
      to: "/$locale/workshops/$slug",
      params: { locale, slug },
      search: workshopProfileRouteSchema.parse({ tab }),
      replace: true,
      resetScroll: false,
      viewTransition: false,
    })
}
