// @vitest-environment node
import { expect, it } from "vitest"

import {
  readRenderIp,
  signClientIp,
  verifyClientIp,
} from "@sayaratak/shared/lib/proxy-client-ip"
import {
  proxyClientIpHeaders,
  readProxyIpConfig,
} from "@/lib/server/proxy-client-ip"

const secret = "local-proxy-test-key-0123456789abcdef"
const now = 1_800_000_000_000
const url = "https://api.example.test/api/v1/site?locale=en"

it("signClientIp and verifyClientIp bind the visitor to the actual upstream request", () => {
  const headers = signClientIp(new Request(url), {
    ip: "192.0.2.1",
    secret,
    now,
  })
  expect(
    verifyClientIp(new Request(url, { headers }), {
      secret,
      origin: "https://api.example.test",
      now,
    })
  ).toBe("192.0.2.1")
})

it("readRenderIp accepts exactly one valid IP, not a forwarded chain", () => {
  expect(readRenderIp(new Headers({ "cf-connecting-ip": "2001:db8::1" }))).toBe(
    "2001:db8::1"
  )
  expect(
    readRenderIp(new Headers({ "cf-connecting-ip": "192.0.2.1, 6.6.6.6" }))
  ).toBeNull()
})

it("readProxyIpConfig rejects Render mode without a dedicated secret", () => {
  expect(readProxyIpConfig({})).toEqual({ mode: "socket" })
  expect(() => readProxyIpConfig({ CLIENT_IP_MODE: "render" })).toThrow(
    "PROXY_CLIENT_IP_SECRET"
  )
})

it.each([
  {
    url: url.replace("/site", "/me"),
    method: "GET",
    origin: "https://api.example.test",
    offset: 0,
    key: secret,
  },
  {
    url: url + "x",
    method: "GET",
    origin: "https://api.example.test",
    offset: 0,
    key: secret,
  },
  {
    url,
    method: "POST",
    origin: "https://api.example.test",
    offset: 0,
    key: secret,
  },
  { url, method: "GET", origin: "https://other.test", offset: 0, key: secret },
  {
    url,
    method: "GET",
    origin: "https://api.example.test",
    offset: 180_001,
    key: secret,
  },
  {
    url,
    method: "GET",
    origin: "https://api.example.test",
    offset: -30_001,
    key: secret,
  },
  {
    url,
    method: "GET",
    origin: "https://api.example.test",
    offset: 0,
    key: "other-key-".repeat(5),
  },
])(
  "rejects mismatched or stale assertions %#",
  ({ url: target, method, origin, offset, key }) => {
    const headers = signClientIp(new Request(url), {
      ip: "192.0.2.1",
      secret,
      now,
    })
    expect(
      verifyClientIp(new Request(target, { method, headers }), {
        secret: key,
        origin,
        now: now + offset,
      })
    ).toBeNull()
  }
)

it.each(["not-an-ip", "192.0.2.1, 6.6.6.6", "x".repeat(100)])(
  "rejects malformed asserted IP %s",
  (ip) => {
    const headers = signClientIp(new Request(url), {
      ip: "192.0.2.1",
      secret,
      now,
    })
    headers.set("x-sy-proxy-ip", ip)
    expect(
      verifyClientIp(new Request(url, { headers }), {
        secret,
        origin: "https://api.example.test",
        now,
      })
    ).toBeNull()
  }
)

it("rejects malformed time/signature and does not expose a signing key", () => {
  const headers = signClientIp(new Request(url), {
    ip: "192.0.2.1",
    secret,
    now,
  })
  expect(JSON.stringify([...headers])).not.toContain(secret)
  headers.set("x-sy-proxy-signature", "z".repeat(64))
  expect(
    verifyClientIp(new Request(url, { headers }), {
      secret,
      origin: "https://api.example.test",
      now,
    })
  ).toBeNull()
  headers.set("x-sy-proxy-time", "NaN")
  expect(
    verifyClientIp(new Request(url, { headers }), {
      secret,
      origin: "https://api.example.test",
      now,
    })
  ).toBeNull()
})

it("proxyClientIpHeaders has no fabricated default visitor IP", () => {
  expect([
    ...proxyClientIpHeaders(new Request(url), new Headers(), {
      mode: "socket",
    }),
  ]).toEqual([])
  expect(() =>
    proxyClientIpHeaders(new Request(url), new Headers(), {
      mode: "render",
      secret,
    })
  ).toThrow("Render client IP")
  expect(() => readProxyIpConfig({ CLIENT_IP_MODE: "unknown" })).toThrow(
    "CLIENT_IP_MODE"
  )
  expect(() =>
    readProxyIpConfig({
      CLIENT_IP_MODE: "render",
      PROXY_CLIENT_IP_SECRET: "short",
    })
  ).toThrow("PROXY_CLIENT_IP_SECRET")
  expect(() =>
    readProxyIpConfig({
      CLIENT_IP_MODE: "render",
      PROXY_CLIENT_IP_SECRET: secret,
      BETTER_AUTH_SECRET: secret,
    })
  ).toThrow("dedicated")
})
