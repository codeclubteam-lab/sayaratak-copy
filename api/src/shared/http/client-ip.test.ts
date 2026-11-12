import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { signClientIp } from "@sayaratak/shared/lib/proxy-client-ip"

import { clientIp } from "~/shared/http/client-ip"
import { onError } from "~/shared/http/errors"
import { rateLimit, resetRateLimits } from "~/shared/http/rate-limit"

const PROXIES = ["10.0.0.0/8", "fd00::1"]

const app = new Hono()
  .use(clientIp(PROXIES))
  .get("/", (c) => c.text(c.get("clientIp")))

// Stands in for the Bun server Hono receives as env.
function from(peer: string) {
  return { requestIP: () => ({ address: peer }) }
}

async function ipOf(peer: string, forwarded?: string) {
  const headers = forwarded ? { "x-forwarded-for": forwarded } : undefined
  const res = await app.request("/", { headers }, from(peer))
  return res.text()
}

describe("clientIp", () => {
  test("a direct peer is the client, X-Forwarded-For ignored", async () => {
    expect(await ipOf("41.1.1.1", "6.6.6.6")).toBe("41.1.1.1")
  })

  test("behind a trusted proxy the last untrusted hop wins", async () => {
    expect(await ipOf("10.0.0.2", "6.6.6.6, 41.1.1.1, 10.0.0.1")).toBe(
      "41.1.1.1"
    )
  })

  test("garbage hops are skipped", async () => {
    expect(await ipOf("10.0.0.2", "41.1.1.1, nonsense")).toBe("41.1.1.1")
  })

  test("all hops trusted gives the leftmost", async () => {
    expect(await ipOf("10.0.0.2", "10.9.9.9, 10.0.0.1")).toBe("10.9.9.9")
  })

  test("IPv6 and IPv4-mapped peers match the list", async () => {
    expect(await ipOf("fd00::1", "41.1.1.1")).toBe("41.1.1.1")
    expect(await ipOf("::ffff:10.0.0.2", "41.1.1.1")).toBe("41.1.1.1")
  })

  test("a trusted proxy with no header is the client", async () => {
    expect(await ipOf("10.0.0.2")).toBe("10.0.0.2")
  })

  test("no Bun server (in-process tests) reads as localhost", async () => {
    const res = await app.request("/", {
      headers: { "x-forwarded-for": "6.6.6.6" },
    })
    expect(await res.text()).toBe("127.0.0.1")
  })
})

const SECRET = "local-proxy-test-key-0123456789abcdef"
const ORIGIN = "https://api.example.test"

function renderApp() {
  return new Hono()
    .onError(onError)
    .use(clientIp([], { mode: "render", secret: SECRET, origin: ORIGIN }))
    .all("/api/v1/site", (c) => c.text(c.get("clientIp")))
    .get("/api/health/live", (c) => c.json({ ok: true }))
}

describe("Render client IP policy", () => {
  test.each(["192.0.2.1", "2001:db8::1"])(
    "direct/native caller uses platform IP %s",
    async (ip) => {
      const res = await renderApp().request(
        "/api/v1/site",
        {
          headers: {
            "cf-connecting-ip": ip,
            "x-forwarded-for": "6.6.6.6",
            "x-sy-client-ip": "6.6.6.6",
          },
        },
        from("::1")
      )
      expect(await res.text()).toBe(ip)
    }
  )

  test.each(["192.0.2.1", "2001:db8::1"])(
    "verified web visitor %s overrides web egress",
    async (ip) => {
      const headers = signClientIp(new Request(`${ORIGIN}/api/v1/site`), {
        ip,
        secret: SECRET,
        now: Date.now(),
      })
      headers.set("cf-connecting-ip", "198.51.100.9")
      const res = await renderApp().request(
        "/api/v1/site",
        { headers },
        from("::1")
      )
      expect(res.status).toBe(200)
      expect(await res.text()).toBe(ip)
    }
  )

  test("a forged claimed signature fails closed", async () => {
    const res = await renderApp().request(
      "/api/v1/site",
      {
        headers: {
          "cf-connecting-ip": "192.0.2.1",
          "x-sy-proxy-ip": "6.6.6.6",
        },
      },
      from("::1")
    )
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({
      code: "forbidden",
      message: "forbidden",
    })
  })

  test("missing provider identity refuses visitor routes but not platform health", async () => {
    expect(
      (await renderApp().request("/api/v1/site", {}, from("::1"))).status
    ).toBe(403)
    expect(
      (await renderApp().request("/api/health/live", {}, from("::1"))).status
    ).toBe(200)
  })

  test("two verified visitors do not share a rate-limit bucket", async () => {
    resetRateLimits()
    const limited = new Hono()
      .onError(onError)
      .use(clientIp([], { mode: "render", secret: SECRET, origin: ORIGIN }))
      .use(rateLimit("contact"))
      .get("/api/v1/site", (c) => c.text(c.get("clientIp")))
    const signed = (ip: string) =>
      signClientIp(new Request(`${ORIGIN}/api/v1/site`), {
        ip,
        secret: SECRET,
        now: Date.now(),
      })
    for (let i = 0; i < 10; i++)
      expect(
        (
          await limited.request(
            "/api/v1/site",
            { headers: signed("192.0.2.1") },
            from("::1")
          )
        ).status
      ).toBe(200)
    expect(
      (
        await limited.request(
          "/api/v1/site",
          { headers: signed("192.0.2.1") },
          from("::1")
        )
      ).status
    ).toBe(429)
    expect(
      (
        await limited.request(
          "/api/v1/site",
          { headers: signed("192.0.2.2") },
          from("::1")
        )
      ).status
    ).toBe(200)
    resetRateLimits()
  })
})
