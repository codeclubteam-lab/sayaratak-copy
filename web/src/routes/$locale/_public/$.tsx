import { createFileRoute, notFound } from "@tanstack/react-router"

import { NotFound } from "@/components/app/not-found"

// Unknown paths under a locale land here. A route that throws notFound() must carry its own notFoundComponent: a layout's would replace the whole layout, header and footer included.
export const Route = createFileRoute("/$locale/_public/$")({
  beforeLoad: () => {
    throw notFound()
  },
  notFoundComponent: NotFound,
})
