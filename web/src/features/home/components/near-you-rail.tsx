import { useState } from "react"

import { useCityName } from "@/hooks/use-city-name"
import { searchPath } from "@/features/search/href"
import { setCookie } from "@/lib/cookie"
import { useT } from "@/lib/i18n/use-t"
import type { Geo } from "@sayaratak/shared/schemas/fields"
import { homeQueries } from "../queries"
import { HomeRail } from "./home-rail"
import { LocationControl, type LocateStatus } from "./location-control"

const DAY = 24 * 60 * 60

// Listings within 25 km of the center of the visitor's city, or within a chosen distance of the device position once they share it. A refused permission keeps the city.
export function NearYouRail({
  city,
  center,
  geo: saved,
}: {
  city: string
  center: Geo
  geo: Geo | null
}) {
  const { t } = useT()
  const cityName = useCityName(city)
  const [geo, setGeo] = useState(saved)
  const [radius, setRadius] = useState(25)
  const [status, setStatus] = useState<LocateStatus>("idle")

  const locate = () => {
    if (!("geolocation" in navigator)) return setStatus("failed")
    setStatus("locating")
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const here = { lat: p.coords.latitude, lng: p.coords.longitude }
        setCookie("geo", `${here.lat},${here.lng}`, DAY)
        setGeo(here)
        setStatus("idle")
      },
      (err) =>
        setStatus(err.code === err.PERMISSION_DENIED ? "denied" : "failed"),
      { timeout: 15_000 }
    )
  }
  const reset = () => {
    setCookie("geo", "", 0)
    setGeo(null)
    setStatus("idle")
  }

  return (
    <HomeRail
      title={t("home.near_you")}
      query={homeQueries.near(geo ?? center, geo ? radius : 25)}
      href={
        geo
          ? searchPath({ ...geo, radius, sort: "nearest" })
          : searchPath({ city })
      }
      empty={geo ? t("home.near_empty", { km: radius }) : undefined}
      action={
        <LocationControl
          geo={geo}
          radius={radius}
          status={status}
          cityName={cityName}
          onLocate={locate}
          onRadius={setRadius}
          onReset={reset}
        />
      }
    />
  )
}
