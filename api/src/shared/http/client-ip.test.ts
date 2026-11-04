import { describe, expect, test } from "bun:test"
import { Hono } from "hono"

import { clientIp } from "~/shared/http/client-ip"

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
