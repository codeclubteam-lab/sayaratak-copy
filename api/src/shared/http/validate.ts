import type { Context, Env, MiddlewareHandler } from "hono"
import type { z } from "zod"

import { type ErrorFields, fail } from "~/shared/http/errors"
import { registerInput } from "~/shared/openapi/registry"

type Target = "json" | "query" | "form"
type Validated<T extends Target, S extends z.ZodType> = MiddlewareHandler<
  Env,
  string,
  { in: { [K in T]: z.input<S> }; out: { [K in T]: z.output<S> } }
>
type Reader = (c: Context, arrayKeys: string[]) => Promise<unknown>

const VALIDATION_KEY_PREFIX = "validation."

/**
 * Route middleware that parses the request with a shared web schema and
 * answers 422 `validation` with `fields` on failure. The parsed value is read
 * with `c.req.valid("json" | "query" | "form")`. `arrayKeys` names keys that
 * are arrays even when sent once (`fuel=petrol`), as the mock's `queryObject`.
 */
export const validate = {
  json: middleware("json", readJson),
  query: middleware("query", readQuery),
  form: middleware("form", readForm),
}

function middleware<T extends Target>(target: T, read: Reader) {
  return <S extends z.ZodType<object>>(
    schema: S,
    arrayKeys: string[] = []
  ): Validated<T, S> => {
    const handler: Validated<T, S> = async (c, next) => {
      const parsed = schema.safeParse(await read(c, arrayKeys))
      if (!parsed.success) fail.validation(toFields(parsed.error))
      c.req.addValidatedData(target, parsed.data)
      await next()
    }
    // The same schema documents the route in openapi.json (A18).
    registerInput(handler, { target, schema })
    return handler
  }
}

// A body that is not JSON reads as `{}`, so the schema reports the missing
// fields (422) instead of a bare 400, the same as the mock.
async function readJson(c: Context) {
  return c.req.json().catch(() => ({}))
}

// Query strings as the mock reads them: repeated keys and `arrayKeys` become
// arrays, "true" and "false" become booleans.
// `?fuel=petrol&fuel=diesel&used=true` gives `{ fuel: ["petrol", "diesel"], used: true }`.
async function readQuery(c: Context, arrayKeys: string[]) {
  const query = new URL(c.req.url).searchParams
  const out: Record<string, unknown> = {}
  for (const key of new Set(query.keys())) {
    const values = query.getAll(key).map(toBoolean)
    out[key] = values.length > 1 || arrayKeys.includes(key) ? values : values[0]
  }
  return out
}

// Same collection for multipart and urlencoded bodies, without the boolean
// rule. A body that does not parse as a form reads as an empty form.
async function readForm(c: Context, arrayKeys: string[]) {
  const form = await c.req.formData().catch(() => new FormData())
  const out: Record<string, unknown> = {}
  for (const key of new Set(form.keys())) {
    const values = form.getAll(key)
    out[key] = values.length > 1 || arrayKeys.includes(key) ? values : values[0]
  }
  return out
}

function toBoolean(value: string) {
  if (value === "true") return true
  if (value === "false") return false
  return value
}

// Zod issues to `fields`, first issue per path. The shared schemas write i18n
// keys as messages; any other message (a Zod default) reads as "required",
// as the mock's `zodFields` does. An issue on the whole body uses the key "_".
export function toFields(error: z.ZodError): ErrorFields {
  const fields: ErrorFields = {}
  for (const issue of error.issues) {
    const name = issue.path.join(".") || "_"
    fields[name] ??= issue.message.startsWith(VALIDATION_KEY_PREFIX)
      ? issue.message
      : "validation.required"
  }
  return fields
}
