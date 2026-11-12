import { proxyClientIpHeaders, type ProxyIpConfig } from "./proxy-client-ip"

export type ApiProxyOptions = {
  apiBaseUrl: string
  fetchImpl?: typeof fetch
  clientIp?: ProxyIpConfig
}

const UPSTREAM_TIMEOUT_MS = 120_000
const HOP_HEADERS = [
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "proxy-connection",
  "te",
  "trailer",
  "transfer-encoding",
  "upgrade",
  "host",
]

export async function forwardApiRequest(
  request: Request,
  options: ApiProxyOptions
): Promise<Response | null> {
  const url = new URL(request.url)
  if (!url.pathname.startsWith("/api/v1/")) return null
  const target = apiTarget(options.apiBaseUrl, url)
  const headers = cleanHeaders(request.headers)
  for (const key of [...headers.keys()]) {
    if (
      /^(forwarded$|x-forwarded-|cf-|true-client-ip$|x-real-ip$|client-ip$|x-client-ip$|x-cluster-client-ip$|fastly-client-ip$|x-sy-(client-ip$|proxy-))/i.test(
        key
      )
    )
      headers.delete(key)
  }
  headers.set("accept-encoding", "identity")
  try {
    proxyClientIpHeaders(
      new Request(target, { method: request.method }),
      request.headers,
      options.clientIp ?? { mode: "socket" }
    ).forEach((value, key) => headers.set(key, value))
  } catch {
    return networkError(502)
  }
  return send(request, target, headers, options.fetchImpl ?? fetch)
}

function apiTarget(base: string, incoming: URL) {
  if (!URL.canParse(base)) throw new Error("Invalid API_BASE_URL origin")
  const url = new URL(base)
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !(base === url.origin || base === `${url.origin}/`)
  )
    throw new Error("Invalid API_BASE_URL origin")
  url.pathname = incoming.pathname
  url.search = incoming.search
  return url
}

function cleanHeaders(source: Headers) {
  const headers = new Headers(source)
  const nominated = (headers.get("connection") ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
  for (const key of [...HOP_HEADERS, ...nominated]) headers.delete(key)
  return headers
}

async function send(
  request: Request,
  target: URL,
  headers: Headers,
  fetchImpl: typeof fetch
) {
  const controller = new AbortController()
  const timeout = { expired: false }
  const abort = () => controller.abort()
  const timer = setTimeout(() => {
    timeout.expired = true
    controller.abort()
  }, UPSTREAM_TIMEOUT_MS)
  request.signal.addEventListener("abort", abort, { once: true })
  if (request.signal.aborted) abort()
  const cleanup = () => {
    clearTimeout(timer)
    request.signal.removeEventListener("abort", abort)
  }
  try {
    const init: RequestInit & { duplex: "half" } = {
      method: request.method,
      headers,
      body: request.body,
      signal: controller.signal,
      redirect: "manual",
      duplex: "half",
    }
    const response = await fetchImpl(target, init)
    const out = cleanHeaders(response.headers)
    for (const key of [...out.keys()]) {
      if (key.startsWith("x-sy-proxy-") || key === "x-sy-client-ip")
        out.delete(key)
    }
    out.delete("content-length")
    out.delete("content-encoding")
    const allowCookies = out.has("set-cookie")
    out.delete("set-cookie")
    for (const cookie of response.headers.getSetCookie()) {
      if (allowCookies) out.append("set-cookie", cookie)
    }
    const body = streamBody(response.body, { cleanup, abort })
    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers: out,
    })
  } catch {
    cleanup()
    return networkError(timeout.expired ? 504 : 502)
  }
}

function streamBody(
  source: ReadableStream<Uint8Array> | null,
  lifecycle: { cleanup: () => void; abort: () => void }
) {
  if (!source) {
    lifecycle.cleanup()
    return null
  }
  const reader = source.getReader()
  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const next = await reader.read()
        if (next.done) {
          lifecycle.cleanup()
          controller.close()
        } else controller.enqueue(next.value)
      } catch (error) {
        lifecycle.cleanup()
        controller.error(error)
      }
    },
    async cancel(reason) {
      lifecycle.abort()
      lifecycle.cleanup()
      await reader.cancel(reason)
    },
  })
}

function networkError(status: number) {
  return Response.json(
    { code: "network", message: "network" },
    {
      status,
      headers: {
        "cache-control": "no-store",
        "x-content-type-options": "nosniff",
        "referrer-policy": "strict-origin-when-cross-origin",
      },
    }
  )
}
