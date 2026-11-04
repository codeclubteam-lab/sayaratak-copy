import { beforeAll, describe, expect, test } from "bun:test"

import { app } from "~/app"
import { env } from "~/env"

import { authPost, req, resetDb, signIn } from "../tests/helpers"

// 10.2: A12's response headers and Cache-Control rule.
const web = new URL(env.WEB_ORIGIN).origin
const evil = "https://evil.example"
const cookie = "sy.session_token=abc"

describe("response headers", () => {
  test("every answer carries the A12 set, success and error alike", async () => {
    const answers = [
      await app.request("/api/health/live"),
      await app.request("/api/v1/nope"),
      await app.request("/api/v1/favorites", {
        method: "POST",
        headers: { cookie, origin: evil },
      }),
    ]
    expect(answers.map((res) => res.status)).toEqual([200, 404, 403])
    for (const res of answers) {
      expect(res.headers.get("x-content-type-options")).toBe("nosniff")
      expect(res.headers.get("referrer-policy")).toBe(
        "strict-origin-when-cross-origin"
      )
      expect(res.headers.get("cache-control")).toBe("no-store")
      // Render's edge sends HSTS; setting it here too would double it.
      expect(res.headers.get("strict-transport-security")).toBeNull()
      // Web and api are one site: pages may embed what the api streams.
      expect(res.headers.get("cross-origin-resource-policy")).toBe("same-site")
      expect(res.headers.get("x-frame-options")).toBe("SAMEORIGIN")
      expect(res.headers.get("x-request-id")).toBeTruthy()
    }
  })

  test("a preflight answer carries the header set too", async () => {
    const res = await app.request("/api/v1/listings", {
      method: "OPTIONS",
      headers: { origin: web, "access-control-request-method": "POST" },
    })
    expect(res.headers.get("x-content-type-options")).toBe("nosniff")
  })
})

describe("Cache-Control (A12)", () => {
  beforeAll(resetDb)

  // `/ad-pages` is on A12's list, but it needs a session here (a price list
  // for advertisers), so a shared cache must never keep it: it stays no-store.
  test.each([
    "/taxonomy",
    "/site",
    "/plans",
    "/promotion-prices",
    "/pages/about",
    "/sitemap",
  ])(
    "the public reference read %s may be cached for a minute",
    async (path) => {
      const res = await req(path)
      expect(res.status).toBe(200)
      expect(res.headers.get("cache-control")).toBe("public, max-age=60")
      expect(res.headers.has("set-cookie")).toBe(false)
    }
  )

  test("an error from a reference read is not cached", async () => {
    const res = await req("/pages/no-such-page")
    expect(res.status).toBe(404)
    expect(res.headers.get("cache-control")).toBe("no-store")
  })

  test.each(["/listings", "/me", "/notifications", "/ad-pages", "/favorites"])(
    "%s is no-store for a visitor",
    async (path) => {
      const res = await req(path)
      expect(res.headers.get("cache-control")).toBe("no-store")
    }
  )

  test("personal answers are no-store for the signed-in account", async () => {
    const as = await signIn("user")
    for (const path of [
      "/me",
      "/me/listings",
      "/notifications",
      "/favorites",
    ]) {
      const res = await req(path, {
        headers: { cookie: as.cookie, origin: as.origin },
      })
      expect(res.status).toBe(200)
      expect(res.headers.get("cache-control")).toBe("no-store")
    }
  })

  test("an answer that sets a cookie is never cacheable", async () => {
    const res = await authPost("/sign-in/email", {
      email: "user@demo.sy",
      password: "Demo1234",
    })
    expect(res.headers.has("set-cookie")).toBe(true)
    expect(res.headers.get("cache-control")).toBe("no-store")
  })
})
