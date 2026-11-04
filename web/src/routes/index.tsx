import { createFileRoute, redirect } from "@tanstack/react-router"

import { getLocaleFromRequest } from "@/lib/i18n/server"

// `/` sends visitors to their language: cookie, then Accept-Language, then Arabic.
export const Route = createFileRoute("/")({
  beforeLoad: async () => {
    throw redirect({
      to: "/$locale",
      params: { locale: await getLocaleFromRequest() },
    })
  },
})
