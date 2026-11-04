import { describe, expect, test } from "bun:test"
import { Hono } from "hono"
import { z } from "zod"

import { validate } from "~/shared/http/validate"
import { buildOpenApi } from "~/shared/openapi/build"
import { spec } from "~/shared/openapi/registry"

const itemSchema = z.object({ id: z.string(), name: z.string() })
const filterSchema = z.object({ q: z.string(), page: z.number().optional() })

const app = new Hono().route(
  "/api/v1",
  new Hono()
    .get(
      "/items/:id",
      spec({
        summary: "One item",
        access: "public",
        responses: { 200: itemSchema },
        errors: ["not_found"],
      }),
      validate.query(filterSchema),
      (c) => c.json({})
    )
    .post(
      "/items",
      spec({
        summary: "Create an item",
        access: "user",
        responses: { 201: itemSchema },
        errors: ["unauthenticated", "forbidden", "banned"],
      }),
      validate.json(z.object({ name: z.string() })),
      (c) => c.json({}, 201)
    )
)

const doc = buildOpenApi(app)
const read = doc.paths["/api/v1/items/{id}"]?.get
const create = doc.paths["/api/v1/items"]?.post

describe("buildOpenApi", () => {
  test("names operations after method and path", () => {
    expect(read).toMatchObject({ operationId: "getItemsById" })
    expect(create).toMatchObject({ operationId: "postItems" })
  })

  test("path and query parameters come from the route and its validate.query", () => {
    expect(read).toMatchObject({
      parameters: [
        { name: "id", in: "path", required: true },
        { name: "q", in: "query", required: true },
        { name: "page", in: "query", required: false },
      ],
    })
  })

  test("the JSON body comes from validate.json and adds 422 validation", () => {
    const body = { type: "object", properties: { name: { type: "string" } } }
    expect(create).toMatchObject({
      requestBody: { content: { "application/json": { schema: body } } },
      responses: { "422": { description: "validation" } },
    })
  })

  test("errors are grouped by status, user routes need a session", () => {
    expect(create).toMatchObject({
      security: [{ session: [] }, { bearer: [] }],
      responses: {
        "401": { description: "unauthenticated" },
        "403": { description: "forbidden, banned" },
      },
    })
    expect(read).toMatchObject({ security: [] })
  })

  test("answers stay open to new fields", () => {
    expect(JSON.stringify(doc)).not.toContain('"additionalProperties":false')
  })

  test("a v1 route without spec() fails the build", () => {
    const bare = new Hono().get("/api/v1/bare", (c) => c.json({}))
    expect(() => buildOpenApi(bare)).toThrow("GET /api/v1/bare has no spec()")
  })
})
