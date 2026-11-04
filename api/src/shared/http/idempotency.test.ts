import { beforeEach, describe, expect, spyOn, test } from "bun:test"
import { Hono } from "hono"
import { z } from "zod"

import { db } from "~/shared/db/client"
import { fail, onError } from "~/shared/http/errors"
import { idempotencyKeys } from "~/shared/http/idempotency.tables"
import { validate } from "~/shared/http/validate"
import { buildOpenApi } from "~/shared/openapi/build"
import { spec } from "~/shared/openapi/registry"
import { clock } from "~/shared/time/clock"

let runs = 0
let gate: Promise<void> | undefined

const app = new Hono().onError(onError).post(
  "/api/v1/things",
  spec({
    summary: "Create a thing",
    access: "public",
    responses: { 201: z.object({ run: z.number() }) },
    errors: ["conflict"],
    idempotent: true,
  }),
  validate.json(z.object({ name: z.string(), fail: z.boolean().optional() })),
  async (c) => {
    runs += 1
    await gate
    if (c.req.valid("json").fail) fail.conflict()
    return c.json({ run: runs }, 201)
  }
)

function post(body: object, headers: Record<string, string> = {}) {
  return app.request("/api/v1/things", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-upload-token": "tok-1",
      "idempotency-key": "K1",
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

beforeEach(async () => {
  runs = 0
  gate = undefined
  await db.delete(idempotencyKeys)
})

describe("idempotency", () => {
  test("a retry with the same key and body replays the stored 201", async () => {
    const first = await post({ name: "a" })
    const retry = await post({ name: "a" })
    expect(first.status).toBe(201)
    expect(retry.status).toBe(201)
    expect(await retry.json()).toEqual({ run: 1 })
    expect(runs).toBe(1)
  })

  test("a retry with another body gets 422 idempotency_mismatch", async () => {
    await post({ name: "a" })
    const res = await post({ name: "b" })
    expect(res.status).toBe(422)
    expect(await res.json()).toMatchObject({ code: "idempotency_mismatch" })
    expect(runs).toBe(1)
  })

  test("a retry while the first still runs gets 409 in_progress", async () => {
    let open = () => {}
    gate = new Promise((resolve) => {
      open = resolve
    })
    const first = post({ name: "a" })
    await Bun.sleep(50)
    const retry = await post({ name: "a" })
    expect(retry.status).toBe(409)
    expect(await retry.json()).toMatchObject({ code: "in_progress" })
    open()
    expect((await first).status).toBe(201)
  })

  test("a key older than 24 hours is free again, whatever its body", async () => {
    const now = clock.now()
    await db.insert(idempotencyKeys).values({
      owner: "upload:tok-1",
      key: "K1",
      method: "POST",
      path: "/api/v1/things",
      requestHash: "other",
      createdAt: new Date(now.getTime() - 25 * 3600 * 1000),
    })
    expect((await post({ name: "a" })).status).toBe(201)
  })

  test("a running key with the same body is taken over after 61 s", async () => {
    const now = clock.now()
    gate = new Promise(() => {})
    void post({ name: "a" })
    await Bun.sleep(50)
    gate = undefined
    const clockSpy = spyOn(clock, "now").mockReturnValue(
      new Date(now.getTime() + 62_000)
    )
    const res = await post({ name: "a" })
    clockSpy.mockRestore()
    expect(res.status).toBe(201)
    expect(runs).toBe(2)
  })

  test("an error answer frees the key, so a retry runs again", async () => {
    expect((await post({ name: "a", fail: true })).status).toBe(409)
    expect((await post({ name: "a", fail: true })).status).toBe(409)
    expect(runs).toBe(2)
  })

  test("without the header, or without an owner, every request runs", async () => {
    await post({ name: "a" }, { "idempotency-key": "" })
    await post({ name: "a" }, { "idempotency-key": "" })
    await post({ name: "a" }, { "x-upload-token": "" })
    await post({ name: "a" }, { "x-upload-token": "" })
    expect(runs).toBe(4)
  })

  test("keys are per owner", async () => {
    await post({ name: "a" })
    const other = await post({ name: "a" }, { "x-upload-token": "tok-2" })
    expect(await other.json()).toEqual({ run: 2 })
  })

  test("a key over 255 characters gets 422 validation", async () => {
    const res = await post(
      { name: "a" },
      { "idempotency-key": "k".repeat(256) }
    )
    expect(res.status).toBe(422)
    expect(runs).toBe(0)
  })

  test("a multipart retry with a new boundary still replays", async () => {
    const form = () => {
      const body = new FormData()
      body.append("name", "a")
      body.append("file", new File(["bytes"], "a.jpg", { type: "image/jpeg" }))
      return body
    }
    const send = () =>
      new Hono()
        .onError(onError)
        .post(
          "/f",
          spec({
            summary: "f",
            access: "public",
            responses: {},
            idempotent: true,
          }),
          async (c) => {
            runs += 1
            await c.req.formData()
            return c.json({ run: runs }, 201)
          }
        )
        .request("/f", {
          method: "POST",
          headers: { "x-upload-token": "tok-1", "idempotency-key": "K9" },
          body: form(),
        })
    expect((await send()).status).toBe(201)
    expect(await (await send()).json()).toEqual({ run: 1 })
  })

  test("openapi lists the header and the two codes", () => {
    const operation = buildOpenApi(app).paths["/api/v1/things"]?.post
    expect(operation).toMatchObject({
      parameters: [{ name: "Idempotency-Key", in: "header", required: false }],
      responses: {
        409: { description: "conflict, in_progress" },
        422: { description: "validation, idempotency_mismatch" },
      },
    })
  })
})
