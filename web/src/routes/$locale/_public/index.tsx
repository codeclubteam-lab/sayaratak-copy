import { createFileRoute } from "@tanstack/react-router"

import { adsQueries } from "@/features/ads/queries"
import { HomePage } from "@/features/home/components/home-page"
import { homeQueries } from "@/features/home/queries"
import { getHomePrefs } from "@/features/home/server"
import { bannersQuery } from "@/features/pages/queries"
import { taxonomyQuery } from "@/features/listings/queries"
import { getCopy } from "@/lib/i18n/server"
import { buildHead } from "@/lib/seo"

const FALLBACK_CITY = "khartoum"

export const Route = createFileRoute("/$locale/_public/")({
  // Hero data (taxonomy) first, then every block in parallel.
  loader: async ({ context }) => {
    const { queryClient, locale } = context
    const [{ cityId, geo }, taxonomy, [title = "", description = ""]] =
      await Promise.all([
        getHomePrefs(),
        queryClient.ensureQueryData(taxonomyQuery),
        getCopy({ data: { locale, keys: ["home.title", "nav.description"] } }),
      ])
    // The `city` cookie's city, else Khartoum.
    const searchCity = taxonomy.cities.some((c) => c.id === cityId)
      ? cityId
      : ""
    const city =
      taxonomy.cities.find((c) => c.id === searchCity) ??
      taxonomy.cities.find((c) => c.id === FALLBACK_CITY) ??
      taxonomy.cities[0]
    const center = city?.center ?? { lat: 15.5007, lng: 32.5599 }
    // Every block is awaited: a query that finishes after the HTML was rendered would be in the client cache but not in the server HTML, and React would report a hydration mismatch. A block that fails is dropped from the cache, so server and client both start from "loading" and the client retries.
    const settle = <T extends { queryKey: readonly unknown[] }>(
      query: T,
      run: (query: T) => Promise<unknown>
    ) =>
      run(query).catch(() =>
        queryClient.removeQueries({ queryKey: query.queryKey })
      )
    await Promise.all([
      settle(homeQueries.featured, (q) => queryClient.ensureQueryData(q)),
      settle(homeQueries.near(geo ?? center, 25), (q) =>
        queryClient.ensureQueryData(q)
      ),
      settle(homeQueries.newest, (q) => queryClient.ensureQueryData(q)),
      settle(homeQueries.rentals, (q) => queryClient.ensureQueryData(q)),
      settle(homeQueries.parts, (q) => queryClient.ensureQueryData(q)),
      settle(homeQueries.dealerships, (q) => queryClient.ensureQueryData(q)),
      settle(homeQueries.workshops, (q) => queryClient.ensureQueryData(q)),
      settle(homeQueries.mechanics, (q) => queryClient.ensureQueryData(q)),
      settle(bannersQuery("home_top"), (q) => queryClient.ensureQueryData(q)),
      settle(bannersQuery("home_middle"), (q) =>
        queryClient.ensureQueryData(q)
      ),
      settle(adsQueries.serve("home_top"), (q) =>
        queryClient.ensureQueryData(q)
      ),
      settle(adsQueries.serve("home_middle"), (q) =>
        queryClient.ensureQueryData(q)
      ),
    ])
    return {
      title,
      description,
      locale,
      searchCity,
      city: city?.id ?? FALLBACK_CITY,
      center,
      geo,
    }
  },
  head: ({ loaderData }) =>
    loaderData
      ? buildHead({
          title: loaderData.title,
          description: loaderData.description,
          path: "/",
          locale: loaderData.locale,
        })
      : {},
  component: Home,
})

function Home() {
  const { searchCity, city, center, geo } = Route.useLoaderData()
  return (
    <HomePage searchCity={searchCity} city={city} center={center} geo={geo} />
  )
}
