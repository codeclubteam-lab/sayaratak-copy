import { describe, expect, test } from "bun:test"
import { Hono } from "hono"

import { appVersion } from "~/shared/http/app-version"
import { onError } from "~/shared/http/errors"

const app = new Hono()
  .onError(onError)
  .use(appVersion({ ios: "1.4.0" }))
  .get("/platform", (c) => c.text(c.get("platform")))

function call(headers: Record<string, string>) {
  return app.request("/platform", { headers })
}

describe("appVersion", () => {
  test("an iOS app below the minimum gets 426 upgrade_required", async () => {
    const res = await call({ "x-platform": "ios", "x-app-version": "1.3.9" })
    expect(res.status).toBe(426)
    expect(await res.json()).toMatchObject({ code: "upgrade_required" })
  })

  test("an iOS app at or above the minimum passes", async () => {
    for (const version of ["1.4.0", "1.10.0", "2.0.0"]) {
      const res = await call({ "x-platform": "ios", "x-app-version": version })
      expect(res.status).toBe(200)
      expect(await res.text()).toBe("ios")
    }
  })

  test("an iOS app with a missing or malformed version gets 426", async () => {
    const cases: Record<string, string>[] = [
      { "x-platform": "ios" },
      { "x-platform": "ios", "x-app-version": "latest" },
    ]
    for (const headers of cases) {
      expect((await call(headers)).status).toBe(426)
    }
  })

  test("a platform without a minimum is not gated", async () => {
    const res = await call({
      "x-platform": "android",
      "x-app-version": "0.1.0",
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("android")
  })

  test("no header or an unknown platform reads as web and passes", async () => {
    const cases: Record<string, string>[] = [{}, { "x-platform": "desktop" }]
    for (const headers of cases) {
      const res = await call(headers)
      expect(res.status).toBe(200)
      expect(await res.text()).toBe("web")
    }
  })
})
