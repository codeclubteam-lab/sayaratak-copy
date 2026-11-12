// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest"

import entry from "@/server"

const mocks = vi.hoisted(() => ({ html: vi.fn() }))
vi.mock("@tanstack/react-start/server-entry", () => ({
  default: { fetch: mocks.html },
  createServerEntry: (value: unknown) => value,
}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  mocks.html.mockReset()
})

it("server entry dispatches API requests before TanStack HTML handling", async () => {
  vi.stubEnv("API_BASE_URL", "https://api.example.test")
  vi.stubEnv("CLIENT_IP_MODE", "socket")
  const upstream = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ locales: ["ar", "en"] }))
  vi.stubGlobal("fetch", upstream)
  const response = await entry.fetch(
    new Request("https://web.example.test/api/v1/site")
  )
  expect(await response.json()).toEqual({ locales: ["ar", "en"] })
  expect(mocks.html).not.toHaveBeenCalled()
  expect(upstream).toHaveBeenCalledOnce()
})

it("ordinary HTML keeps TanStack nonce context and security headers", async () => {
  vi.stubEnv("CLIENT_IP_MODE", "socket")
  vi.stubEnv("DEV", false)
  mocks.html.mockResolvedValue(
    new Response("<html>unchanged</html>", {
      headers: { "content-type": "text/html" },
    })
  )
  const response = await entry.fetch(new Request("https://web.example.test/en"))
  const [, opts] = mocks.html.mock.calls[0]!
  expect(typeof opts.context.nonce).toBe("string")
  expect(response.headers.get("content-security-policy")).toContain(
    `'nonce-${opts.context.nonce}'`
  )
  expect(response.headers.get("x-content-type-options")).toBe("nosniff")
  expect(response.headers.get("referrer-policy")).toBe(
    "strict-origin-when-cross-origin"
  )
  expect(await response.text()).toBe("<html>unchanged</html>")
})
