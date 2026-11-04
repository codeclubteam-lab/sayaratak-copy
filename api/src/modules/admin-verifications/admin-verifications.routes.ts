import { adminVerificationSchema } from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { rejectInputSchema } from "@sayaratak/shared/schemas/inputs"
import { Hono } from "hono"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireAdmin } from "~/modules/auth/auth.middleware"

import {
  approveVerification,
  getAdminVerifications,
  rejectVerification,
} from "./admin-verifications.service"

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const

export const adminVerificationsRoutes = new Hono()

adminVerificationsRoutes.get(
  "/admin/verifications",
  spec({
    summary:
      "Verification requests newest first, each with its documents, business and owner; filters `status`, `id` and `q` (business or owner name), paged. Documents are private pictures the admin opens with a session",
    access: "user",
    responses: { 200: pageOf(adminVerificationSchema) },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getAdminVerifications(c.req.query()))
)

adminVerificationsRoutes.post(
  "/admin/verifications/:id/approve",
  spec({
    summary:
      "Accept a pending request: the business gets the verified badge and the owner is told. A request already decided answers 409 `conflict`",
    access: "user",
    responses: { 200: adminVerificationSchema },
    errors: [...ADMIN_ERRORS, "not_found", "conflict"],
  }),
  requireAdmin,
  async (c) =>
    c.json(await approveVerification(c.get("actor"), c.req.param("id")))
)

adminVerificationsRoutes.post(
  "/admin/verifications/:id/reject",
  spec({
    summary:
      "Decline a pending request with a reason; the owner is told and can ask again",
    access: "user",
    responses: { 200: adminVerificationSchema },
    errors: [...ADMIN_ERRORS, "not_found", "conflict", "validation"],
  }),
  requireAdmin,
  validate.json(rejectInputSchema),
  async (c) =>
    c.json(
      await rejectVerification(c.get("actor"), {
        id: c.req.param("id"),
        reason: c.req.valid("json").reason,
      })
    )
)
