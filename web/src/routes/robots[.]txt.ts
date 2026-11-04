import { createFileRoute } from "@tanstack/react-router"

import { robotsTxt } from "@/lib/sitemap"

export const Route = createFileRoute("/robots.txt")({
  server: {
    handlers: {
      GET: ({ request }: { request: Request }) =>
        new Response(
          robotsTxt(process.env.APP_ORIGIN || new URL(request.url).origin),
          {
            headers: {
              "content-type": "text/plain; charset=utf-8",
              "cache-control": "public, max-age=3600",
            },
          }
        ),
    },
  },
})
