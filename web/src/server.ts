import handler, { createServerEntry } from "@tanstack/react-start/server-entry"

import { tileUrl } from "@/lib/map"

const originOf = (url?: string) => (url ? new URL(url).origin : "")

// One nonce per request: the router puts it on every inline script it renders (see router.tsx), the CSP allows only those.
function csp(nonce: string) {
  const images = [
    "'self'",
    "data:",
    "blob:",
    originOf(tileUrl.replace(/\{\w\}/g, "0")),
    process.env.IMAGE_ORIGINS ?? "",
  ]
  const api = originOf(process.env.VITE_API_BASE_URL)
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    // React style props, Leaflet and the chart theme write inline styles.
    "style-src 'self' 'unsafe-inline'",
    `img-src ${images.join(" ")}`,
    "media-src 'self' blob:",
    "font-src 'self' data:",
    `connect-src 'self' ${api}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join("; ")
}

export default createServerEntry({
  async fetch(request, opts) {
    const nonce = crypto.randomUUID()
    const res = await handler.fetch(request, {
      ...opts,
      context: { ...opts?.context, nonce },
    })
    const out = new Response(res.body, res)
    out.headers.set("X-Content-Type-Options", "nosniff")
    out.headers.set("Referrer-Policy", "strict-origin-when-cross-origin")
    // Vite's dev server injects its own inline scripts, so the policy is production only.
    if (
      !import.meta.env.DEV &&
      out.headers.get("Content-Type")?.includes("text/html")
    )
      out.headers.set("Content-Security-Policy", csp(nonce))
    return out
  },
})
