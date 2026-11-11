import process from "node:process"

// SSR fault/latency proxy used only during `STATES=1` runs (step 11.5).
// Intercepts server-side `API_BASE_URL` fetches that carry `test_fail` or `test_latency`
// cookies while keeping `/api/v1/me`, `/api/v1/auth/*`, `/api/_test/*` and health checks live.
const port = Number(process.env.STATES_PROXY_PORT ?? 4099)
const target = (
  process.env.STATES_API_TARGET ?? "http://localhost:4000"
).replace(/\/$/, "")
const skip = /^\/(?:api\/v1\/(?:me$|auth\/)|api\/(?:_test|health)\/)/

function readCookie(header: string, name: string) {
  for (const part of header.split(";")) {
    const eq = part.indexOf("=")
    if (eq <= 0) continue
    if (part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return undefined
}

Bun.serve({
  port,
  async fetch(req) {
    const url = new URL(req.url)
    const pathname = url.pathname
    if (!skip.test(pathname)) {
      const cookie = req.headers.get("cookie") ?? ""
      const latency = Number(readCookie(cookie, "test_latency") ?? 0)
      if (latency > 0) await Bun.sleep(latency)
      const fail = Number(readCookie(cookie, "test_fail") ?? 0)
      if (fail === 404 || fail === 422 || fail === 500) {
        return Response.json(
          {
            code:
              fail === 404
                ? "not_found"
                : fail === 422
                  ? "validation"
                  : "server_error",
          },
          { status: fail }
        )
      }
    }
    const headers = new Headers(req.headers)
    headers.delete("host")
    const hasBody = req.method !== "GET" && req.method !== "HEAD"
    const res = await fetch(`${target}${pathname}${url.search}`, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      redirect: "manual",
    })
    const out = new Headers(res.headers)
    out.delete("content-encoding")
    out.delete("content-length")
    return new Response(res.body, { status: res.status, headers: out })
  },
})
