import { describe, expect, test } from "bun:test"

import { app } from "~/app"
import { env } from "~/env"

// 10.2: A12's CORS and Origin rule, one claim per test.
const web = new URL(env.WEB_ORIGIN).origin
const evil = "https://evil.example"
const cookie = "sy.session_token=abc"
const WRITE_METHODS = ["POST", "PUT", "PATCH", "DELETE"] as const

describe("CORS", () => {
  test.each(["GET", "POST", "PATCH", "PUT", "DELETE"])(
    "a preflight for %s from the web origin is allowed with credentials",
    async (method) => {
      const res = await app.request("/api/v1/listings", {
        method: "OPTIONS",
        headers: {
          origin: web,
          "access-control-request-method": method,
          "access-control-request-headers": "content-type",
        },
      })
      expect(res.status).toBe(204)
      expect(res.headers.get("access-control-allow-origin")).toBe(web)
      expect(res.headers.get("access-control-allow-credentials")).toBe("true")
      expect(res.headers.get("access-control-allow-methods")).toContain(method)
      expect(res.headers.get("vary")).toContain("Origin")
    }
  )

  test("only content-type is allowed: the apps send bearer tokens without CORS", async () => {
    const res = await app.request("/api/v1/listings", {
      method: "OPTIONS",
      headers: { origin: web, "access-control-request-method": "POST" },
    })
    expect(res.headers.get("access-control-allow-headers")).toBe("content-type")
  })

  test("a preflight from another origin, with a cookie, names no allowed origin", async () => {
    for (const origin of [
      evil,
      "null",
      `${web}.evil.example`,
      "http://localhost:3001",
    ]) {
      const res = await app.request("/api/v1/favorites", {
        method: "OPTIONS",
        headers: {
          origin,
          cookie,
          "access-control-request-method": "DELETE",
        },
      })
      // Hono still adds the credentials flag; without an allowed origin the
      // browser ignores it.
      expect(res.headers.get("access-control-allow-origin")).toBeNull()
    }
  })

  test("the web origin can read error answers: 404, the Origin refusal and a bad route", async () => {
    const answers = [
      await app.request("/api/v1/nope", { headers: { origin: web } }),
      await app.request("/api/v1/favorites", {
        method: "POST",
        headers: { origin: web, cookie: "" },
      }),
      await app.request("/api/v1/favorites", {
        method: "POST",
        headers: { cookie }, // no Origin: the 403 comes from csrfOrigin
      }),
    ]
    expect(answers.map((res) => res.status)).toEqual([404, 401, 403])
    for (const res of answers.slice(0, 2)) {
      expect(res.headers.get("access-control-allow-origin")).toBe(web)
      expect(res.headers.get("access-control-allow-credentials")).toBe("true")
    }
  })

  test("a request from another origin gets no allowed origin, so the browser hides the answer", async () => {
    const res = await app.request("/api/v1/nope", {
      headers: { origin: evil },
    })
    expect(res.headers.get("access-control-allow-origin")).toBeNull()
  })
})

describe("Origin rule (csrfOrigin)", () => {
  const refused: [string, Record<string, string>][] = [
    ["another site", { origin: evil }],
    ["no Origin header", {}],
    ["the literal null origin", { origin: "null" }],
    [
      "the same host on another scheme",
      { origin: web.replace("http:", "https:") },
    ],
    ["the same host on another port", { origin: "http://localhost:3999" }],
    ["a lookalike host", { origin: `${web}.evil.example` }],
    ["the web origin with a path", { origin: `${web}/x` }],
  ]

  for (const method of WRITE_METHODS) {
    test.each(refused)(
      `${method} with the session cookie and %s is 403`,
      async (_name, headers) => {
        const res = await app.request("/api/v1/favorites", {
          method,
          headers: { cookie, ...headers },
        })
        expect(res.status).toBe(403)
        expect(await res.json()).toMatchObject({ code: "forbidden" })
      }
    )
  }

  test("the cookie's value does not matter: a forged or expired one is refused too", async () => {
    const res = await app.request("/api/v1/favorites", {
      method: "POST",
      headers: { cookie: "sy.session_token=", origin: evil },
    })
    expect(res.status).toBe(403)
  })

  test("a multipart upload with the cookie and another origin is refused before the body is read", async () => {
    const body = new FormData()
    body.set("file", new File(["x"], "x.png", { type: "image/png" }))
    const res = await app.request("/api/v1/uploads", {
      method: "POST",
      headers: { cookie, origin: evil },
      body,
    })
    expect(res.status).toBe(403)
  })

  test("reads are never refused for their Origin, whoever asks", async () => {
    for (const method of ["GET", "HEAD"]) {
      const res = await app.request("/api/v1/no-such-route", {
        method,
        headers: { cookie, origin: evil },
      })
      expect(res.status).toBe(404)
    }
  })

  test("the web origin with the cookie passes the rule", async () => {
    for (const method of WRITE_METHODS) {
      const res = await app.request("/api/v1/no-such-route", {
        method,
        headers: { cookie, origin: web },
      })
      expect(res.status).toBe(404)
    }
  })

  test("a bearer app sends no cookie and no Origin, and passes the rule", async () => {
    const res = await app.request("/api/v1/no-such-route", {
      method: "POST",
      headers: { authorization: "Bearer abc" },
    })
    expect(res.status).toBe(404)
  })
})
