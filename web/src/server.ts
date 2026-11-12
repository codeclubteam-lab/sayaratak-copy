import handler, { createServerEntry } from "@tanstack/react-start/server-entry"

import { buildCsp } from "@/lib/csp"
import { forwardApiRequest } from "@/lib/server/api-proxy"
import { readDeploymentConfig } from "@/lib/server/deployment-config"
import { readProxyIpConfig } from "@/lib/server/proxy-client-ip"

const source = {
  ...process.env,
  NODE_ENV: import.meta.env.PROD ? "production" : process.env.NODE_ENV,
}
const deployment = readDeploymentConfig(source)
// The browser URL is baked into JS. A runtime env edit cannot repair a stale build.
if (import.meta.env.PROD)
  readDeploymentConfig({
    ...source,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL ?? "",
  })

export default createServerEntry({
  async fetch(request, opts) {
    const api = await forwardApiRequest(request, {
      apiBaseUrl: deployment.apiBaseUrl,
      clientIp: readProxyIpConfig(process.env),
    })
    if (api) return api
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
