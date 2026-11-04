import { beforeAll, describe, expect, test } from "bun:test"

import { env } from "~/env"

import { req, resetDb } from "../../../tests/helpers"

// 10.2: Better-Auth's own Origin and callbackURL checks against
// `trustedOrigins` (A12). Better-Auth turns both off when NODE_ENV is "test"
// unless `disableOriginCheck: false` is set, which auth.config.ts does.
const web = new URL(env.WEB_ORIGIN).origin
const evil = "https://evil.example"
const credentials = { email: "user@demo.sy", password: "Demo1234" }

beforeAll(resetDb)

function signIn(headers: Record<string, string>, extra: object = {}) {
  return req("/auth/sign-in/email", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ ...credentials, ...extra }),
  })
}

describe("Origin header on Better-Auth routes", () => {
  test("another site cannot sign a browser in: 403 even without a cookie", async () => {
    const res = await signIn({ origin: evil })
    expect(res.status).toBe(403)
    expect(res.headers.get("set-cookie")).toBeNull()
  })

  test("a lookalike host and another scheme are refused", async () => {
    for (const origin of [
      `${web}.evil.example`,
      web.replace("http:", "https:"),
    ]) {
      expect((await signIn({ origin })).status).toBe(403)
    }
  })

  test("the web origin signs in", async () => {
    const res = await signIn({ origin: web })
    expect(res.status).toBe(200)
    expect(res.headers.getSetCookie().length).toBeGreaterThan(0)
  })

  test("an app sends no Origin and no cookie, and gets its bearer token", async () => {
    const res = await signIn({})
    expect(res.status).toBe(200)
    expect(res.headers.get("set-auth-token")).toBeTruthy()
  })

  test("a cookie with another origin or none is refused", async () => {
    expect(
      (await signIn({ cookie: "sy.session_token=x", origin: evil })).status
    ).toBe(403)
    expect((await signIn({ cookie: "sy.session_token=x" })).status).toBe(403)
  })

  test("a cross-site page navigating to the sign-in route is blocked (login CSRF)", async () => {
    const res = await signIn({
      "sec-fetch-site": "cross-site",
      "sec-fetch-mode": "navigate",
      "sec-fetch-dest": "document",
    })
    expect(res.status).toBe(403)
  })
})

describe("callbackURL", () => {
  test("a callback on another site is refused, so sign-in is no open redirect", async () => {
    const res = await signIn({ origin: web }, { callbackURL: `${evil}/steal` })
    expect(res.status).toBe(403)
    expect(res.headers.get("set-cookie")).toBeNull()
  })

  test("a callback on the web origin and a relative path pass", async () => {
    for (const callbackURL of [`${web}/ar/dashboard`, "/ar/dashboard"]) {
      const res = await signIn({ origin: web }, { callbackURL })
      expect(res.status).toBe(200)
    }
  })

  test("a protocol-relative or scheme trick is refused", async () => {
    for (const callbackURL of [
      `//evil.example/x`,
      `${web}@evil.example/x`,
      "javascript:alert(1)",
    ]) {
      const res = await signIn({ origin: web }, { callbackURL })
      expect(res.status).toBe(403)
    }
  })
})
