import { describe, expect, test } from "bun:test"
import { app } from "~/app"
import { env } from "~/env"

const web = new URL(env.WEB_ORIGIN).origin
const session = "sy.session_token=abc"

test("GET /api/health/live answers ok", async () => {
  const res = await app.request("/api/health/live")
  expect(res.status).toBe(200)
  expect(await res.json()).toEqual({ ok: true })
})

test("an unknown route answers 404 not_found", async () => {
  const res = await app.request("/api/v1/nope")
  expect(res.status).toBe(404)
  expect(await res.json()).toEqual({ code: "not_found", message: "not_found" })
})

describe("request id and headers", () => {
  test("every response carries a request id, an incoming one is kept", async () => {
    const fresh = await app.request("/api/health/live")
    expect(fresh.headers.get("x-request-id")).toMatch(/^[\w-]{36}$/)
    const kept = await app.request("/api/health/live", {
      headers: { "x-request-id": "abc-123" },
    })
    expect(kept.headers.get("x-request-id")).toBe("abc-123")
  })

  test("A12 headers, also on error responses", async () => {
    for (const path of ["/api/health/live", "/api/v1/nope"]) {
      const res = await app.request(path)
      expect(res.headers.get("x-content-type-options")).toBe("nosniff")
      expect(res.headers.get("referrer-policy")).toBe(
        "strict-origin-when-cross-origin"
      )
      expect(res.headers.get("cache-control")).toBe("no-store")
      expect(res.headers.get("strict-transport-security")).toBeNull()
    }
  })
})

describe("CORS", () => {
  test("a preflight from the web origin is answered", async () => {
    const res = await app.request("/api/v1/listings", {
      method: "OPTIONS",
      headers: {
        origin: web,
        "access-control-request-method": "PATCH",
        "access-control-request-headers": "content-type",
      },
    })
    expect(res.status).toBe(204)
    expect(res.headers.get("access-control-allow-origin")).toBe(web)
    expect(res.headers.get("access-control-allow-credentials")).toBe("true")
    expect(res.headers.get("access-control-allow-methods")).toBe(
      "GET,POST,PATCH,PUT,DELETE"
    )
    expect(res.headers.get("access-control-allow-headers")).toBe("content-type")
  })

  test("another origin is never echoed back", async () => {
    const res = await app.request("/api/health/live", {
      headers: { origin: "https://evil.example" },
    })
    expect(res.headers.get("access-control-allow-origin")).toBeNull()
  })
})

describe("Origin check", () => {
  test("a cross-origin POST with the session cookie gets 403 forbidden", async () => {
    const res = await app.request("/api/v1/favorites", {
      method: "POST",
      headers: { origin: "https://evil.example", cookie: session },
    })
    expect(res.status).toBe(403)
    expect(await res.json()).toMatchObject({ code: "forbidden" })
  })

  test("a DELETE with the cookie and no Origin gets 403", async () => {
    const res = await app.request("/api/v1/favorites", {
      method: "DELETE",
      headers: { cookie: `__Secure-${session}` },
    })
    expect(res.status).toBe(403)
  })

  test("the web origin, a cookieless POST and a cross-origin GET pass", async () => {
    const cases: RequestInit[] = [
      { method: "POST", headers: { origin: web, cookie: session } },
      { method: "POST", headers: { origin: "https://evil.example" } },
      {
        method: "GET",
        headers: { origin: "https://evil.example", cookie: session },
      },
    ]
    for (const init of cases) {
      const res = await app.request("/api/v1/no-such-route", init)
      expect(res.status).toBe(404)
    }
  })
})
