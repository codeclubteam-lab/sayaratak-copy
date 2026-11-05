type ProbeSchema = {
  type: string
  properties: Record<
    string,
    {
      type: string
      enum?: string[]
      deprecated?: boolean
      "x-sunset"?: string
    }
  >
  required: string[]
}

/** Builds a small OpenAPI 3.1 contract for the CI guard's regression probes. */
export function fixture(path = "/api/v1/probe") {
  const request: ProbeSchema = {
    type: "object",
    properties: { name: { type: "string" } },
    required: [],
  }
  const response: ProbeSchema = {
    type: "object",
    properties: {
      id: { type: "string" },
      note: { type: "string" },
      state: { type: "string", enum: ["active", "sold"] },
    },
    required: ["id", "state"],
  }
  const lifecycle: { deprecated?: boolean; "x-sunset"?: string } = {}
  const document = {
    openapi: "3.1.0",
    info: { title: "Contract probe", version: "1" },
    paths: {
      [path]: {
        post: {
          ...lifecycle,
          requestBody: {
            content: { "application/json": { schema: request } },
          },
          responses: {
            "200": {
              description: "OK",
              content: { "application/json": { schema: response } },
            },
          },
        },
      },
    },
  }
  return { document, request, response }
}
