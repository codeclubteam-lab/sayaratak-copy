import type { RouterRoute } from "hono/types"
import { z } from "zod"

import { type ErrorCode, statusOf } from "~/shared/http/errors"

import { type InputSpec, inputOf, type RouteSpec, specOf } from "./registry"

const V1_PREFIX = "/api/v1/"
const MEDIA_TYPES = {
  json: "application/json",
  form: "multipart/form-data",
} as const
// Browsers send the cookie; the apps send `Authorization: Bearer` (A18).
const SECURITY_SCHEMES = {
  session: { type: "apiKey", in: "cookie", name: "sy.session_token" },
  bearer: { type: "http", scheme: "bearer" },
}
const SIGNED_IN = [{ session: [] }, { bearer: [] }]
const IDEMPOTENCY_KEY = {
  name: "Idempotency-Key",
  in: "header",
  required: false,
  description:
    "A UUID per user action, sent again on retry. Kept 24 hours (A18).",
  schema: { type: "string", maxLength: 255 },
}

type Operation = { spec?: RouteSpec; inputs: InputSpec[] }
type JsonSchema = Record<string, unknown>

/**
 * OpenAPI 3.1 for every v1 route, built from the live router: each route's
 * `spec()` gives summary, access and answers, its `validate.*` middleware the
 * inputs. A v1 route without `spec()` throws, so none goes undocumented.
 */
export function buildOpenApi(app: { routes: RouterRoute[] }) {
  const paths: Record<string, Record<string, unknown>> = {}
  for (const [key, operation] of collect(app.routes)) {
    const [method = "", path = ""] = key.split(" ")
    if (!operation.spec) throw new Error(`${key} has no spec()`)
    const openApiPath = path.replace(/:(\w+)/g, "{$1}")
    paths[openApiPath] ??= {}
    paths[openApiPath][method.toLowerCase()] = {
      operationId: operationId(method, path),
      ...toOperation(path, { ...operation, spec: operation.spec }),
    }
  }
  return {
    openapi: "3.1.0",
    info: { title: "Sayaratak API", version: "1" },
    // Paths carry the /api/v1 prefix, so the server is the API's own origin.
    servers: [{ url: "/" }],
    paths,
    components: { securitySchemes: SECURITY_SCHEMES },
  }
}

// Hono lists every handler of a route as its own entry, middleware included:
// `get("/site", spec(...), handler)` gives two `GET /api/v1/site` entries.
function collect(routes: RouterRoute[]) {
  const operations = new Map<string, Operation>()
  for (const route of routes) {
    if (route.method === "ALL" || !route.path.startsWith(V1_PREFIX)) continue
    const key = `${route.method} ${route.path}`
    const operation = operations.get(key) ?? { inputs: [] }
    operation.spec ??= specOf(route.handler)
    const input = inputOf(route.handler)
    if (input) operation.inputs.push(input)
    operations.set(key, operation)
  }
  return operations
}

// Generated clients name their methods after it, so it follows the path:
// `GET /api/v1/site` is getSite, `PATCH /api/v1/listings/:id` is
// patchListingsById.
function operationId(method: string, path: string) {
  const words = path
    .slice(V1_PREFIX.length)
    .split(/[/.-]/)
    .filter(Boolean)
    .flatMap((word) => (word.startsWith(":") ? ["by", word.slice(1)] : [word]))
  const capitalized = words.map(
    (word) => word[0]?.toUpperCase() + word.slice(1)
  )
  return method.toLowerCase() + capitalized.join("")
}

function toOperation(path: string, { spec, inputs }: Required<Operation>) {
  const query = inputs.find((input) => input.target === "query")
  const body = inputs.find((input) => input.target !== "query")
  const errors = [...(spec.errors ?? [])]
  if (inputs.length > 0 || spec.idempotent) errors.push("validation")
  if (spec.idempotent) errors.push("in_progress", "idempotency_mismatch")
  return {
    summary: spec.summary,
    security: spec.access === "user" ? SIGNED_IN : [],
    parameters: [
      ...pathParameters(path),
      ...queryParameters(query),
      ...(spec.idempotent ? [IDEMPOTENCY_KEY] : []),
    ],
    ...(body && { requestBody: requestBody(body) }),
    responses: { ...successResponses(spec), ...errorResponses(errors) },
  }
}

function pathParameters(path: string) {
  return [...path.matchAll(/:(\w+)/g)].map(([, name]) => ({
    name,
    in: "path",
    required: true,
    schema: { type: "string" },
  }))
}

function queryParameters(query: InputSpec | undefined) {
  if (!query) return []
  const schema = jsonSchema(query.schema, "input")
  const properties = z
    .record(z.string(), z.unknown())
    .parse(schema.properties ?? {})
  const required = z.array(z.string()).parse(schema.required ?? [])
  return Object.entries(properties).map(([name, property]) => ({
    name,
    in: "query",
    required: required.includes(name),
    schema: property,
  }))
}

function requestBody({ target, schema }: InputSpec) {
  const mediaType = target === "form" ? MEDIA_TYPES.form : MEDIA_TYPES.json
  return {
    required: true,
    content: { [mediaType]: { schema: jsonSchema(schema, "input") } },
  }
}

function successResponses(spec: RouteSpec) {
  return Object.fromEntries(
    Object.entries(spec.responses).map(([status, schema]) => [
      status,
      { description: "OK", content: jsonContent(jsonSchema(schema, "output")) },
    ])
  )
}

// One entry per status, listing every code the route can answer with it.
// `errors: ["not_found", "forbidden"]` gives 404 with `not_found` and 403
// with `forbidden`; the body is the A7 error shape.
function errorResponses(codes: ErrorCode[]) {
  const byStatus = Map.groupBy(new Set(codes), (code) => statusOf(code))
  return Object.fromEntries(
    [...byStatus].map(([status, group]) => [
      String(status),
      { description: group.join(", "), content: jsonContent(errorBody(group)) },
    ])
  )
}

function errorBody(codes: ErrorCode[]) {
  const body = z.object({
    code: z.literal(codes),
    message: z.string(),
    fields: z.record(z.string(), z.string()).optional(),
    retryAfter: z.number().int().optional(),
  })
  return jsonSchema(body, "output")
}

function jsonContent(schema: JsonSchema) {
  return { [MEDIA_TYPES.json]: { schema } }
}

// OpenAPI 3.1 uses JSON Schema 2020-12, Zod 4's default target. `$schema` is
// dropped because the document already states its dialect. Answers lose
// Zod's `additionalProperties: false`: v1 may add response fields (A1 rule
// 21), and a client generated from a closed schema would reject them.
function jsonSchema(schema: z.ZodType, io: "input" | "output"): JsonSchema {
  const { $schema: _, ...rest } = z.toJSONSchema(schema, {
    io,
    unrepresentable: "any",
    override: ({ jsonSchema: node }) => {
      if (io === "output" && node.additionalProperties === false) {
        delete node.additionalProperties
      }
    },
  })
  return rest
}
