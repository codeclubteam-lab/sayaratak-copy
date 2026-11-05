import { describe, expect, test } from "bun:test"
import { Hono } from "hono"

import { docsRoutes } from "./docs"

describe("GET /api/docs", () => {
  test.each(["development", "test"])(
    "serves the read-only contract page in %s",
    async (appEnv) => {
      const app = new Hono().route("/api", docsRoutes(appEnv))
      const res = await app.request("/api/docs")
      expect(res.status).toBe(200)
      expect(res.headers.get("content-type")).toContain("text/html")
      const html = await res.text()
      expect(html).toContain("/api/v1/openapi.json")
      expect(html).toContain(
        "https://cdn.jsdelivr.net/npm/@scalar/api-reference"
      )
      expect(html).toContain('"hideClientButton":true')
      expect(html).toContain('"hideTestRequestButton":true')
      expect(html).toContain('"agent":{"disabled":true}')
      expect(html).toContain('"proxyUrl":""')
    }
  )

  test("returns 404 in production", async () => {
    const app = new Hono().route("/api", docsRoutes("production"))
    const res = await app.request("/api/docs")
    expect(res.status).toBe(404)
    expect(await res.text()).not.toContain("@scalar/api-reference")
  })
})
