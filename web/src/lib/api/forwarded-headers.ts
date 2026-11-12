import { createServerOnlyFn } from "@tanstack/react-start"

// Not createServerFn: no RPC may return a visitor's cookie or a usable IP assertion to JS.
export const getForwardedHeaders = createServerOnlyFn(
  async (url: string, method: string) => {
    const { getRequestHeaders } = await import("@tanstack/react-start/server")
    const { proxyClientIpHeaders, readProxyIpConfig } =
      await import("@/lib/server/proxy-client-ip")
    const incoming = getRequestHeaders()
    const headers = proxyClientIpHeaders(
      new Request(url, { method }),
      incoming,
      readProxyIpConfig(process.env)
    )
    const cookie = incoming.get("cookie")
    if (cookie) headers.set("cookie", cookie)
    return headers
  }
)
