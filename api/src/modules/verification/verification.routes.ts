import { verificationRequestSchema } from "@sayaratak/shared/schemas/admin"
import { verificationFormSchema } from "@sayaratak/shared/schemas/inputs"
import { Hono } from "hono"
import { bodyLimit } from "hono/body-limit"

import { fail } from "~/shared/http/errors"
import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireRole, requireUser } from "~/modules/auth/auth.middleware"

import { getMyVerification, submitVerification } from "./verification.service"

export const verificationRoutes = new Hono()

// Five documents of 5 MB plus the multipart overhead; a bigger body is refused before it is read.
const BODY_MAX_BYTES = 26 * 1024 * 1024

verificationRoutes.post(
  "/me/verification",
  bodyLimit({
    maxSize: BODY_MAX_BYTES,
    onError: () => fail.validation({ file: "validation.file_size_5mb" }),
  }),
  spec({
    summary:
      "A dealership, workshop or mechanic asks for the verified badge: 1 to 5 labelled images (multipart `label` and `file` per document, optional `note`)",
    access: "user",
    responses: { 200: verificationRequestSchema },
    errors: [
      "unauthenticated",
      "banned",
      "forbidden",
      "validation",
      "not_found",
      "conflict",
    ],
    idempotent: true,
  }),
  requireRole("dealership", "workshop", "mechanic"),
  validate.form(verificationFormSchema, ["label", "file"]),
  async (c) =>
    c.json(await submitVerification(c.get("user"), c.req.valid("form")))
)

verificationRoutes.get(
  "/me/verification",
  spec({
    summary: "The account's newest verification request, or null",
    access: "user",
    responses: { 200: verificationRequestSchema.nullable() },
    errors: ["unauthenticated", "banned"],
  }),
  requireUser,
  async (c) => c.json(await getMyVerification(c.get("user")))
)
