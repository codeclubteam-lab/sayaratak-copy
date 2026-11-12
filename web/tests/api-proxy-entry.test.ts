// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ html: vi.fn() }))
vi.mock("@tanstack/react-start/server-entry", () => ({
  default: { fetch: mocks.html },
  createServerEntry: (value: unknown) => value,
}))
afterEach(() => {
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  mocks.html.mockReset()
  vi.resetModules()
})

it("server entry dispatches API requests before TanStack HTML handling", async () => {
  vi.stubEnv("API_BASE_URL", "https://api.example.test")
  vi.stubEnv("CLIENT_IP_MODE", "socket")
  const upstream = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ locales: ["ar", "en"] }))
  vi.stubGlobal("fetch", upstream)
  const { default: entry } = await import("@/server")
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
  const { default: entry } = await import("@/server")
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

it("production entry rejects a missing upstream before handling any request", async () => {
  vi.stubEnv("PROD", true)
  vi.stubEnv("API_BASE_URL", "")
  vi.stubEnv("APP_ORIGIN", "https://web.example.test")
  await expect(import("@/server")).rejects.toThrow("API_BASE_URL")
  expect(mocks.html).not.toHaveBeenCalled()
})

it("production entry rejects a browser URL for a different website", async () => {
  vi.stubEnv("PROD", true)
  vi.stubEnv("API_BASE_URL", "https://api.example.test")
  vi.stubEnv("APP_ORIGIN", "https://web.example.test")
  vi.stubEnv("VITE_API_BASE_URL", "https://stale.example.test")
  await expect(import("@/server")).rejects.toThrow("VITE_API_BASE_URL")
})
