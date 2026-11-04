import { createFileRoute } from "@tanstack/react-router"

import { MapPage } from "@/features/map/components/map-page"
import { mapSearchSchema } from "@/features/map/schemas"
import { taxonomyQuery } from "@/features/listings/queries"
import { getCopy } from "@/lib/i18n/server"
import { buildHead } from "@/lib/seo"

// Client-only: Leaflet needs a window, and the pins depend on the viewport. The server sends the shell and the `noindex` tag.
export const Route = createFileRoute("/$locale/_public/map")({
  ssr: false,
  validateSearch: mapSearchSchema,
  loader: async ({ context }) => {
    const [copy] = await Promise.all([
      getCopy({
        data: {
          locale: context.locale,
          keys: ["map.title", "map.description"],
        },
      }),
      context.queryClient.ensureQueryData(taxonomyQuery),
    ])
    const [title = "", description = ""] = copy
    return { title, description, locale: context.locale }
  },
  head: ({ loaderData }) =>
    loaderData
      ? buildHead({ ...loaderData, path: "/map", noindex: true })
      : { meta: [{ name: "robots", content: "noindex, follow" }] },
  component: MapRoute,
})

function MapRoute() {
  const navigate = Route.useNavigate()
  return (
    <MapPage
      search={Route.useSearch()}
      onChange={(next) =>
        navigate({
          search: next,
          replace: true,
          resetScroll: false,
          viewTransition: false,
        })
      }
    />
  )
}
