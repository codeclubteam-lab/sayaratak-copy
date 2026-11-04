import { okSchema } from "@sayaratak/shared/schemas/api"
import { emailSchema, nameSchema } from "@sayaratak/shared/schemas/fields"
import { Hono, type MiddlewareHandler } from "hono"
import { z } from "zod"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"

import {
  adminInputSchema,
  adminPatchSchema,
  checkSecretKey,
  confirmChange,
  requestCode,
} from "./platform-admin.service"

// The one admin account, managed with a secret key instead of a session (8.12). Every call needs
// `x-secret-key`; changes also need `x-confirm-code` and `x-confirm-at` from `POST .../code`.
export const platformAdminRoutes = new Hono()

const admin = z.object({
  id: z.string(),
  email: emailSchema,
  name: nameSchema,
})
const asked = z.object({ at: z.number().int(), expiresIn: z.number().int() })
const operation = z.discriminatedUnion("op", [
  z.object({ op: z.literal("create"), input: adminInputSchema }),
  z.object({ op: z.literal("update"), input: adminPatchSchema }),
  z.object({ op: z.literal("delete") }),
])
const ERRORS = [
  "forbidden",
  "not_found",
  "conflict",
  "exists",
  "validation",
  "otp_invalid",
  "code_expired",
  "too_many_attempts",
] as const

// Before validation, so a caller without the key learns nothing about the bodies.
const keyed: MiddlewareHandler = async (c, next) => {
  await checkSecretKey({
    key: c.req.header("x-secret-key"),
    ip: c.get("clientIp"),
  })
  await next()
}
const confirmOf = (c: {
  req: { header: (name: string) => string | undefined }
}) => ({
  code: c.req.header("x-confirm-code"),
  at: c.req.header("x-confirm-at"),
})

platformAdminRoutes.post(
  "/platform/admin/code",
  spec({
    summary:
      "Step 1: mail a 6-digit code for one change to the owner's inbox. Body `{ op: create|update|delete, input }` is the change itself; the code fits that change only and lasts 10 minutes. Answers when it was asked (`at`), to send back as `x-confirm-at`. 404 while the endpoint is off. Needs `x-secret-key`",
    access: "public",
    responses: { 200: asked },
    errors: [...ERRORS],
  }),
  keyed,
  validate.json(operation),
  async (c) => c.json(await requestCode(c.req.valid("json")))
)

platformAdminRoutes.post(
  "/platform/admin",
  spec({
    summary:
      "Step 2: create the admin, only while the platform has none. Needs `x-secret-key`, `x-confirm-code` and `x-confirm-at`",
    access: "public",
    responses: { 200: admin },
    errors: [...ERRORS],
  }),
  keyed,
  validate.json(adminInputSchema),
  async (c) =>
    c.json(
      await confirmChange(
        { ip: c.get("clientIp"), confirm: confirmOf(c) },
        { op: "create", input: c.req.valid("json") }
      )
    )
)

platformAdminRoutes.patch(
  "/platform/admin",
  spec({
    summary:
      "Step 2: change the admin's name, email or password; a new email or password signs the admin out everywhere. Needs `x-secret-key`, `x-confirm-code` and `x-confirm-at`",
    access: "public",
    responses: { 200: admin },
    errors: [...ERRORS],
  }),
  keyed,
  validate.json(adminPatchSchema),
  async (c) =>
    c.json(
      await confirmChange(
        { ip: c.get("clientIp"), confirm: confirmOf(c) },
        { op: "update", input: c.req.valid("json") }
      )
    )
)

platformAdminRoutes.delete(
  "/platform/admin",
  spec({
    summary:
      "Step 2: delete the admin account; the platform has none until a create. Needs `x-secret-key`, `x-confirm-code` and `x-confirm-at`",
    access: "public",
    responses: { 200: okSchema },
    errors: [...ERRORS],
  }),
  keyed,
  async (c) => {
    await confirmChange(
      { ip: c.get("clientIp"), confirm: confirmOf(c) },
      { op: "delete" }
    )
    return c.json({ ok: true })
  }
)
