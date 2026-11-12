// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest"

import { verifyClientIp } from "@sayaratak/shared/lib/proxy-client-ip"
import { getForwardedHeaders } from "@/lib/api/forwarded-headers"

const incoming = vi.hoisted(() => ({ headers: new Headers() }))

vi.mock("@tanstack/react-start", () => ({
  createServerOnlyFn: (fn: unknown) => fn,
}))
vi.mock("@tanstack/react-start/server", () => ({
  getRequestHeaders: () => incoming.headers,
}))
afterEach(() => vi.unstubAllEnvs())

it("getForwardedHeaders signs SSR requests without exposing a signing RPC", async () => {
  vi.stubEnv("CLIENT_IP_MODE", "render")
  vi.stubEnv("PROXY_CLIENT_IP_SECRET", "local-proxy-test-key-0123456789abcdef")
  incoming.headers = new Headers({
    cookie: "session=test",
    "cf-connecting-ip": "192.0.2.7",
  })
  const url = "https://api.example.test/api/v1/me"
  const headers = await getForwardedHeaders(url, "GET")
  expect(headers.get("cookie")).toBe("session=test")
  expect(
    verifyClientIp(new Request(url, { headers }), {
      secret: process.env.PROXY_CLIENT_IP_SECRET!,
      origin: "https://api.example.test",
      now: Date.now(),
    })
  ).toBe("192.0.2.7")
})

it("SSR socket mode preserves cookies without exposing or forwarding forged IP assertions", async () => {
  vi.stubEnv("CLIENT_IP_MODE", "socket")
  incoming.headers = new Headers({
    cookie: "session=test",
    "x-sy-proxy-ip": "6.6.6.6",
  })
  expect([
    ...(await getForwardedHeaders("http://localhost:4000/api/v1/me", "GET")),
  ]).toEqual([["cookie", "session=test"]])
})

it("SSR Render mode refuses missing ingress identity rather than manufacturing an IP", async () => {
  vi.stubEnv("CLIENT_IP_MODE", "render")
  vi.stubEnv("PROXY_CLIENT_IP_SECRET", "p".repeat(32))
  incoming.headers = new Headers()
  await expect(
    getForwardedHeaders("https://api.example.test/api/v1/me", "GET")
  ).rejects.toThrow("Render client IP")
})
