import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { z } from "zod"

import { loginInputSchema } from "@sayaratak/shared/schemas/inputs"
import { searchParamsSchema } from "@sayaratak/shared/search/schemas"
import { onError } from "~/shared/http/errors"
import { validate } from "~/shared/http/validate"

const formSchema = z.object({
  title: z.string().min(1, "validation.required"),
  tags: z.array(z.string()),
})

const strictQuerySchema = z.object({
  sort: z.enum(["newest", "price"], "validation.required"),
})

// Error bodies parsed, not cast.
const errorBodySchema = z.object({
  code: z.string(),
  fields: z.record(z.string(), z.string()),
})
async function errorBody(res: Response) {
  return errorBodySchema.parse(await res.json())
}

const app = new Hono<{ Variables: { userId: string } }>()
  .onError(onError)
  .post("/login", validate.json(loginInputSchema), (c) =>
    c.json(c.req.valid("json"))
  )
  .get("/search", validate.query(searchParamsSchema, ["fuel"]), (c) =>
    c.json(c.req.valid("query"))
  )
  .get("/sorted", validate.query(strictQuerySchema), (c) =>
    c.json(c.req.valid("query"))
  )
  .post("/form", validate.form(formSchema, ["tags"]), (c) =>
    c.json(c.req.valid("form"))
  )

function postJson(path: string, body: string) {
  return app.request(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  })
}

describe("validate.json", () => {
  test("returns 422 validation with fields keyed by the shared schema", async () => {
    const res = await postJson("/login", JSON.stringify({ email: "nope" }))
    expect(res.status).toBe(422)
    const body = await errorBody(res)
    expect(body.code).toBe("validation")
    expect(Object.keys(body.fields).sort()).toEqual(["email", "password"])
    for (const key of Object.values(body.fields)) {
      expect(key).toStartWith("validation.")
    }
  })

  test("a body that is not JSON reads as empty and lists every field", async () => {
    const res = await postJson("/login", "{oops")
    expect(res.status).toBe(422)
    expect(Object.keys((await errorBody(res)).fields).sort()).toEqual([
      "email",
      "password",
    ])
  })

  test("passes the parsed body to the handler", async () => {
    const input = { email: "a@b.co", password: "secret" }
    const res = await postJson("/login", JSON.stringify(input))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual(input)
  })
})

describe("validate.query", () => {
  test("collects repeated keys into arrays", async () => {
    const res = await app.request("/search?fuel=petrol&fuel=diesel")
    expect(await res.json()).toMatchObject({ fuel: ["petrol", "diesel"] })
  })

  test("an array key sent once is still an array", async () => {
    const res = await app.request("/search?fuel=petrol")
    expect(await res.json()).toMatchObject({ fuel: ["petrol"] })
  })

  test("the search schema drops a bad value instead of failing", async () => {
    const res = await app.request("/search?fuel=plutonium")
    expect(res.status).toBe(200)
    expect(await res.json()).not.toHaveProperty("fuel")
  })

  test("a strict schema answers 422 validation on that key", async () => {
    const res = await app.request("/sorted?sort=oldest")
    expect(res.status).toBe(422)
    expect((await errorBody(res)).fields).toEqual({
      sort: "validation.required",
    })
  })
})

describe("validate.form", () => {
  test("collects form fields, with arrayKeys as arrays", async () => {
    const form = new FormData()
    form.append("title", "Hilux")
    form.append("tags", "4x4")
    const res = await app.request("/form", { method: "POST", body: form })
    expect(await res.json()).toEqual({ title: "Hilux", tags: ["4x4"] })
  })

  test("a missing field is 422 with its i18n key", async () => {
    const res = await app.request("/form", {
      method: "POST",
      body: new FormData(),
    })
    expect(res.status).toBe(422)
    expect((await errorBody(res)).fields).toEqual({
      title: "validation.required",
      tags: "validation.required",
    })
  })
})
