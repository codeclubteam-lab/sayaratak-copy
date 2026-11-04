import { useNavigate } from "@tanstack/react-router"

import { useT } from "@/lib/i18n/use-t"
import {
  mechanicProfileRouteSchema,
  type MechanicProfileSearch,
} from "./mechanic-schemas"

// The tab lives in the URL. Replace, no scroll reset, no view transition.
export function useMechanicProfileNavigation(slug: string) {
  const navigate = useNavigate()
  const { locale } = useT()
  return (tab: MechanicProfileSearch["tab"]) =>
    navigate({
      to: "/$locale/mechanics/$slug",
      params: { locale, slug },
      search: mechanicProfileRouteSchema.parse({ tab }),
      replace: true,
      resetScroll: false,
      viewTransition: false,
    })
}
