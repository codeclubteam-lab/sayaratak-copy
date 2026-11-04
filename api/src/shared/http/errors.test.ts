import { describe, expect, spyOn, test } from "bun:test"
import { Hono } from "hono"
import { requestId } from "hono/request-id"

import { fail, onError, onNotFound } from "~/shared/http/errors"

const app = new Hono()
  .onError(onError)
  .notFound(onNotFound)
  .use(requestId())
  .get("/conflict", () => fail.conflict("bump_wait"))
  .get("/too-many", () => fail.tooMany(30))
  .get("/crash", () => {
    throw new Error("password=hunter2 at db.ts:12")
  })

describe("error responses", () => {
  test("a fail.* call answers with its handoff status and code", async () => {
    const res = await app.request("/conflict")
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({
      code: "bump_wait",
      message: "bump_wait",
    })
  })

  test("429 carries retryAfter in seconds", async () => {
    const res = await app.request("/too-many")
    expect(res.status).toBe(429)
    expect(await res.json()).toMatchObject({
      code: "too_many_attempts",
      retryAfter: 30,
    })
  })

  test("an unknown error becomes 500 server_error without leaking its message", async () => {
    const res = await app.request("/crash")
    expect(res.status).toBe(500)
    const text = await res.text()
    expect(JSON.parse(text)).toEqual({
      code: "server_error",
      message: "server_error",
    })
    expect(text).not.toContain("hunter2")
  })

  test("the 500 is logged with its request id and masked", async () => {
    const write = spyOn(process.stdout, "write").mockImplementation(() => true)
    try {
      await app.request("/crash", { headers: { "x-request-id": "req-1" } })
      const line = String(write.mock.calls[0]?.[0])
      expect(line).toContain('"requestId":"req-1"')
      expect(line).toContain('"route":"/crash"')
      expect(line).toContain("password=[redacted]")
      expect(line).not.toContain("hunter2")
    } finally {
      write.mockRestore()
    }
  })

  test("an unknown route is 404 not_found", async () => {
    const res = await app.request("/nope")
    expect(res.status).toBe(404)
    expect(await res.json()).toMatchObject({ code: "not_found" })
  })
})
