import handler, { createServerEntry } from "@tanstack/react-start/server-entry"

import { buildCsp } from "@/lib/csp"

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
      out.headers.set("Content-Security-Policy", buildCsp(nonce))
    return out
  },
})
