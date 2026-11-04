import { createFileRoute } from "@tanstack/react-router"

// The mock stays server-only: imported inside the handler, never at module level.
export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const [{ sitemapEntries }, { sitemapXml }] = await Promise.all([
          import("@/mocks/sitemap"),
          import("@/lib/sitemap"),
        ])
        const origin = process.env.APP_ORIGIN || new URL(request.url).origin
        return new Response(sitemapXml(origin, sitemapEntries()), {
          headers: {
            "content-type": "application/xml; charset=utf-8",
            "cache-control": "public, max-age=3600",
          },
        })
      },
    },
  },
})
