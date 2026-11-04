import { describe, expect, spyOn, test } from "bun:test"
import { Hono } from "hono"
import { requestId } from "hono/request-id"

import { env } from "~/env"
import { app } from "~/app"
import { createLogger } from "~/shared/log/logger"

import { clientIp } from "./client-ip"
import { onError } from "./errors"
import { requestLog } from "./request-log"

function logged(enabled = true) {
  const lines: Record<string, unknown>[] = []
  const logger = createLogger("debug", (line) => {
    lines.push(JSON.parse(line) as Record<string, unknown>)
  })
  const router = new Hono()
    .onError(onError)
    .use(requestId())
    .use(clientIp(["10.0.0.0/8"]))
    .use(requestLog(logger, () => enabled))
    .use(async (c, next) => {
      if (c.req.header("x-user")) {
        c.set("viewer", { id: c.req.header("x-user") } as never)
      }
      await next()
    })
    .get("/api/v1/listings/:id", (c) => c.json({ id: c.req.param("id") }))
    .get("/api/health/ready", (c) => c.json({ ok: true }))
    .get("/api/v1/crash", () => {
      throw new Error("boom")
    })
  return { lines, router }
}

describe("requestLog", () => {
  test("one line per request: id, method, route pattern, status, ms, user id", async () => {
    const { lines, router } = logged()
    await router.request("/api/v1/listings/l-77?token=secret-abc", {
      headers: { "x-request-id": "req-9", "x-user": "u-omar" },
    })
    expect(lines).toHaveLength(1)
    expect(lines[0]).toMatchObject({
      level: "info",
      msg: "request",
      requestId: "req-9",
      method: "GET",
      route: "/api/v1/listings/:id",
      status: 200,
      userId: "u-omar",
    })
    expect(typeof lines[0]?.ms).toBe("number")
  })

  test("the line carries the client IP, read through the trusted proxy", async () => {
    const { lines, router } = logged()
    const proxy = { requestIP: () => ({ address: "10.0.0.2" }) }
    await router.request(
      "/api/v1/listings/l-1",
      { headers: { "x-forwarded-for": "6.6.6.6, 41.1.1.1" } },
      proxy
    )
    expect(lines[0]).toMatchObject({ ip: "41.1.1.1" })
  })

  test("the id, the query string and the token never reach the line", async () => {
    const { lines, router } = logged()
    await router.request("/api/v1/listings/l-77?token=secret-abc")
    const text = JSON.stringify(lines)
    expect(text).not.toContain("l-77")
    expect(text).not.toContain("secret-abc")
  })

  test("a visitor has no user id", async () => {
    const { lines, router } = logged()
    await router.request("/api/v1/listings/l-1")
    expect(lines[0]).not.toHaveProperty("userId")
  })

  test("a 500 and an unknown route are lines too, with their status", async () => {
    const { lines, router } = logged()
    await router.request("/api/v1/crash")
    await router.request("/api/v1/nope")
    expect(lines.map((line) => line.status)).toEqual([500, 404])
  })

  test("health checks are debug lines", async () => {
    const { lines, router } = logged()
    await router.request("/api/health/ready")
    expect(lines[0]).toMatchObject({
      level: "debug",
      route: "/api/health/ready",
    })
  })

  test("a disabled logger writes nothing", async () => {
    const { lines, router } = logged(false)
    await router.request("/api/v1/listings/l-1")
    expect(lines).toEqual([])
  })
})

describe("in the app", () => {
  test("the app logs each request unless LOG_REQUESTS is false", async () => {
    const write = spyOn(process.stdout, "write").mockImplementation(() => true)
    const was = env.LOG_REQUESTS
    try {
      // Tests run with LOG_REQUESTS=false (tests/setup.ts).
      await app.request("/api/v1/nope")
      expect(write).not.toHaveBeenCalled()
      env.LOG_REQUESTS = true
      await app.request("/api/v1/nope?x=1", {
        headers: { "x-request-id": "req-app" },
      })
      const line = JSON.parse(String(write.mock.calls[0]?.[0]))
      expect(line).toMatchObject({
        msg: "request",
        requestId: "req-app",
        method: "GET",
        status: 404,
      })
      expect(JSON.stringify(line)).not.toContain("x=1")
    } finally {
      env.LOG_REQUESTS = was
      write.mockRestore()
    }
  })
})
