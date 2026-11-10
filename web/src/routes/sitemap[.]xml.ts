import { createFileRoute } from "@tanstack/react-router"
import { sitemapEntrySchema } from "@sayaratak/shared/schemas/responses"
import { z } from "zod"

import { apiFetch } from "@/lib/api/client"
import { sitemapXml } from "@/lib/sitemap"

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const entries = await apiFetch("/sitemap", {
          schema: z.array(sitemapEntrySchema),
        })
        const origin = process.env.APP_ORIGIN || new URL(request.url).origin
        return new Response(sitemapXml(origin, entries), {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        })
      },
    },
  },
})
