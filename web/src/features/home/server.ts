import { createServerFn } from "@tanstack/react-start"
import { getCookie } from "@tanstack/react-start/server"

import { geoSchema } from "@sayaratak/shared/schemas/fields"

// `city` and `geo` are written in the browser (hero city select, "Use my location"); the loader reads them here so the server HTML matches.
export const getHomePrefs = createServerFn().handler(() => {
  const [lat, lng] = (getCookie("geo") ?? "").split(",").map(Number)
  const geo = geoSchema.safeParse({ lat, lng })
  return {
    cityId: getCookie("city") ?? "",
    geo: geo.success ? geo.data : null,
  }
})
