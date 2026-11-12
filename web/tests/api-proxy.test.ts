// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest"

import { verifyClientIp } from "@sayaratak/shared/lib/proxy-client-ip"

import { forwardApiRequest } from "@/lib/server/api-proxy"

const upstream = "https://sayaratak-api-91a8.onrender.com"
const website = "https://sayaratak-web.onrender.com"
afterEach(() => vi.useRealTimers())

it("forwards site requests to the fixed API origin", async () => {
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ locales: ["ar", "en"] }))
  const response = await forwardApiRequest(
    new Request("https://sayaratak-web.onrender.com/api/v1/site?locale=en"),
    { apiBaseUrl: "https://sayaratak-api-91a8.onrender.com", fetchImpl }
  )
  expect(response?.status).toBe(200)
  const [input, init] = fetchImpl.mock.calls[0]!
  expect(new Request(input, init).url).toBe(
    "https://sayaratak-api-91a8.onrender.com/api/v1/site?locale=en"
  )
  await response?.text()
})

it.each([
  "/api/_test/reset",
  "/mock/reset",
  "/en",
  "/api/v10/site",
  "/api/v1",
  "/api/v1/../_test/reset",
])("does not forward %s", async (path) => {
  const fetchImpl = vi.fn<typeof fetch>()
  expect(
    await forwardApiRequest(new Request(website + path), {
      apiBaseUrl: upstream,
      fetchImpl,
    })
  ).toBeNull()
  expect(fetchImpl).not.toHaveBeenCalled()
})

it.each([
  "https://u:p@api.test",
  "https://api.test/api/v1",
  "https://api.test?q=x",
  "file:///tmp/api",
  "not a URL",
])("rejects non-origin upstream %s", async (base) => {
  const fetchImpl = vi.fn<typeof fetch>()
  await expect(
    forwardApiRequest(new Request(website + "/api/v1/site"), {
      apiBaseUrl: base,
      fetchImpl,
    })
  ).rejects.toThrow("API_BASE_URL")
  expect(fetchImpl).not.toHaveBeenCalled()
})

it.each(["POST", "PATCH"])(
  "preserves JSON %s body, query, auth, origin and application headers",
  async (method) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(Response.json({ saved: true }))
    const request = new Request(website + "/api/v1/me?locale=ar", {
      method,
      body: '{"name":"اسم"}',
      headers: {
        "content-type": "application/json",
        cookie: "session=private",
        authorization: "Bearer native",
        origin: website,
        "idempotency-key": "once",
        "x-platform": "android",
        "x-app-version": "1.2.3",
      },
    })
    const response = await forwardApiRequest(request, {
      apiBaseUrl: upstream,
      fetchImpl,
    })
    const [input, init] = fetchImpl.mock.calls[0]!
    const sent = new Request(input, init)
    expect(sent.method).toBe(method)
    expect(await sent.text()).toBe('{"name":"اسم"}')
    for (const [key, value] of request.headers)
      expect(sent.headers.get(key)).toBe(value)
    expect(sent.url).toBe(upstream + "/api/v1/me?locale=ar")
    expect(init?.redirect).toBe("manual")
    await response?.text()
  }
)

it("preserves multipart boundaries and byte-identical uploaded content", async () => {
  const form = new FormData()
  form.set("file", new File([new Uint8Array([0, 255, 17, 10])], "receipt.bin"))
  form.set("label", "مرفق")
  const request = new Request(website + "/api/v1/uploads", {
    method: "POST",
    body: form,
  })
  const expected = await request.clone().arrayBuffer()
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ id: "upload" }))
  const response = await forwardApiRequest(request, {
    apiBaseUrl: upstream,
    fetchImpl,
  })
  const [input, init] = fetchImpl.mock.calls[0]!
  const sent = new Request(input, init)
  expect(sent.headers.get("content-type")).toBe(
    request.headers.get("content-type")
  )
  expect(await sent.arrayBuffer()).toEqual(expected)
  await response?.text()
})

it("strips hop-by-hop and forged forwarding metadata, then signs only platform IP", async () => {
  const secret = "local-proxy-test-key-0123456789abcdef"
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ ok: true }))
  const response = await forwardApiRequest(
    new Request(website + "/api/v1/site", {
      headers: {
        host: "attacker.invalid",
        connection: "x-hop, keep-alive",
        "x-hop": "private",
        "keep-alive": "timeout=2",
        forwarded: "for=6.6.6.6",
        "x-forwarded-for": "6.6.6.6",
        "x-real-ip": "6.6.6.6",
        "cf-connecting-ip": "192.0.2.1",
        "cf-ray": "forged",
        "x-sy-client-ip": "6.6.6.6",
        "x-sy-proxy-signature": "forged",
        "x-sy-proxy-ip": "6.6.6.6",
      },
    }),
    { apiBaseUrl: upstream, fetchImpl, clientIp: { mode: "render", secret } }
  )
  const [input, init] = fetchImpl.mock.calls[0]!
  const sent = new Request(input, init)
  for (const key of [
    "host",
    "connection",
    "x-hop",
    "keep-alive",
    "forwarded",
    "x-forwarded-for",
    "x-real-ip",
    "cf-connecting-ip",
    "cf-ray",
    "x-sy-client-ip",
  ])
    expect(sent.headers.has(key)).toBe(false)
  expect(
    verifyClientIp(sent, { secret, origin: upstream, now: Date.now() })
  ).toBe("192.0.2.1")
  await response?.text()
})

it("refuses missing Render identity without contacting upstream", async () => {
  const fetchImpl = vi.fn<typeof fetch>()
  const response = await forwardApiRequest(
    new Request(website + "/api/v1/site"),
    {
      apiBaseUrl: upstream,
      fetchImpl,
      clientIp: { mode: "render", secret: "p".repeat(32) },
    }
  )
  expect(response?.status).toBe(502)
  expect(fetchImpl).not.toHaveBeenCalled()
})

it("keeps separate cookies including logout expiry and OAuth Location", async () => {
  const headers = new Headers({
    location: "https://accounts.google.com/o/oauth2/auth?state=test",
  })
  headers.append(
    "set-cookie",
    "session=; Expires=Thu, 01 Jan 1970 00:00:00 GMT; Path=/; HttpOnly"
  )
  headers.append(
    "set-cookie",
    "state=nonce; Path=/; Secure; HttpOnly; SameSite=Lax"
  )
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(null, { status: 302, headers }))
  const response = await forwardApiRequest(
    new Request(website + "/api/v1/auth/sign-out", { method: "POST" }),
    { apiBaseUrl: upstream, fetchImpl }
  )
  expect(response?.status).toBe(302)
  expect(response?.headers.getSetCookie()).toEqual(headers.getSetCookie())
  expect(response?.headers.get("location")).toBe(headers.get("location"))
  expect(fetchImpl).toHaveBeenCalledTimes(1)
  expect(fetchImpl.mock.calls[0]?.[1]?.redirect).toBe("manual")
})

it.each([401, 403, 422, 429])(
  "preserves HTTP %s and error/retry headers",
  async (status) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json(
          { code: "refused" },
          { status, headers: { "retry-after": "30" } }
        )
      )
    const response = await forwardApiRequest(
      new Request(website + "/api/v1/me"),
      { apiBaseUrl: upstream, fetchImpl }
    )
    expect(response?.status).toBe(status)
    expect(response?.headers.get("retry-after")).toBe("30")
    expect(await response?.json()).toEqual({ code: "refused" })
  }
)

it("streams binary responses and drops stale compression/length and nominated hop headers", async () => {
  const bytes = new Uint8Array([0, 255, 10, 17])
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
    new Response(bytes, {
      headers: {
        "content-type": "application/octet-stream",
        "content-length": "99",
        "content-encoding": "gzip",
        connection: "x-internal",
        "x-internal": "private",
      },
    })
  )
  const response = await forwardApiRequest(
    new Request(website + "/api/v1/uploads/private"),
    { apiBaseUrl: upstream, fetchImpl }
  )
  expect(response?.headers.get("content-type")).toBe("application/octet-stream")
  for (const key of [
    "content-length",
    "content-encoding",
    "connection",
    "x-internal",
  ])
    expect(response?.headers.has(key)).toBe(false)
  expect(await response?.arrayBuffer()).toEqual(bytes.buffer)
})

it.each(["POST", "PATCH", "DELETE"])(
  "returns no-store 502 without retrying failed %s",
  async (method) => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new Error("private upstream detail"))
    const response = await forwardApiRequest(
      new Request(website + "/api/v1/me", { method }),
      { apiBaseUrl: upstream, fetchImpl }
    )
    expect(response?.status).toBe(502)
    expect(response?.headers.get("cache-control")).toBe("no-store")
    expect(await response?.json()).toEqual({
      code: "network",
      message: "network",
    })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  }
)

function abortableFetch() {
  return vi.fn<typeof fetch>().mockImplementation(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        const abort = () => reject(new DOMException("Aborted", "AbortError"))
        if (init?.signal?.aborted) abort()
        else init?.signal?.addEventListener("abort", abort, { once: true })
      })
  )
}

it("aborts after the bounded cold-start timeout and answers no-store 504", async () => {
  vi.useFakeTimers()
  const fetchImpl = abortableFetch()
  const pending = forwardApiRequest(new Request(website + "/api/v1/site"), {
    apiBaseUrl: upstream,
    fetchImpl,
  })
  await vi.advanceTimersByTimeAsync(120_000)
  const response = await pending
  expect(response?.status).toBe(504)
  expect(await response?.json()).toEqual({
    code: "network",
    message: "network",
  })
  expect(response?.headers.get("cache-control")).toBe("no-store")
  expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  expect(vi.getTimerCount()).toBe(0)
})

it("aborts upstream when the visitor disconnects", async () => {
  const controller = new AbortController()
  const fetchImpl = abortableFetch()
  const pending = forwardApiRequest(
    new Request(website + "/api/v1/site", { signal: controller.signal }),
    { apiBaseUrl: upstream, fetchImpl }
  )
  controller.abort()
  expect((await pending)?.status).toBe(502)
  expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
})

it("cancels upstream when a streamed response is cancelled", async () => {
  const cancel = vi.fn()
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(new ReadableStream({ cancel })))
  const response = await forwardApiRequest(
    new Request(website + "/api/v1/uploads/private"),
    { apiBaseUrl: upstream, fetchImpl }
  )
  await response?.body?.cancel()
  expect(cancel).toHaveBeenCalledTimes(1)
  expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
})

it("keeps disconnect propagation active after upstream response headers", async () => {
  const controller = new AbortController()
  const fetchImpl = vi
    .fn<typeof fetch>()
    .mockResolvedValue(new Response(new ReadableStream()))
  const response = await forwardApiRequest(
    new Request(website + "/api/v1/uploads/private", {
      signal: controller.signal,
    }),
    { apiBaseUrl: upstream, fetchImpl }
  )
  controller.abort()
  expect(fetchImpl.mock.calls[0]?.[1]?.signal?.aborted).toBe(true)
  await response?.body?.cancel()
})

it("does not expose private assertion response headers", async () => {
  const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
    Response.json(
      {},
      {
        headers: {
          "x-sy-proxy-ip": "192.0.2.1",
          "x-sy-proxy-signature": "private",
          "x-sy-client-ip": "192.0.2.1",
        },
      }
    )
  )
  const response = await forwardApiRequest(
    new Request(website + "/api/v1/site"),
    { apiBaseUrl: upstream, fetchImpl }
  )
  for (const key of ["x-sy-proxy-ip", "x-sy-proxy-signature", "x-sy-client-ip"])
    expect(response?.headers.has(key)).toBe(false)
  await response?.text()
})
