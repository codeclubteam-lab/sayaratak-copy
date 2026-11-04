import { paymentSchema } from "@sayaratak/shared/schemas/billing"
import { rejectInputSchema } from "@sayaratak/shared/schemas/inputs"
import { adminPaymentsPageSchema } from "@sayaratak/shared/schemas/responses"
import { Hono } from "hono"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireAdmin } from "~/modules/auth/auth.middleware"

import { approve, getAdminPayments, reject } from "./admin-payments.service"

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const

export const adminPaymentsRoutes = new Hono()

adminPaymentsRoutes.get(
  "/admin/payments",
  spec({
    summary:
      "Payments newest first with the payer and what approval starts; filters `status`, `userId`, `id` and `q` (reference, transfer number, item), paged; `summary` holds the money approved this Khartoum month and what waits for review",
    access: "user",
    responses: { 200: adminPaymentsPageSchema },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getAdminPayments(c.req.query()))
)

adminPaymentsRoutes.post(
  "/admin/payments/:id/approve",
  spec({
    summary:
      "Accept a receipt under review: the plan, promotion or campaign it paid for starts and the payer is told. A payment already decided answers 409 `exists`",
    access: "user",
    responses: { 200: paymentSchema },
    errors: [...ADMIN_ERRORS, "not_found", "exists"],
  }),
  requireAdmin,
  async (c) => c.json(await approve(c.get("actor"), c.req.param("id")))
)

adminPaymentsRoutes.post(
  "/admin/payments/:id/reject",
  spec({
    summary:
      "Refuse a receipt under review with a reason; the payer is told, a refused plan comes back as the one to pay for and a refused campaign is unpaid again",
    access: "user",
    responses: { 200: paymentSchema },
    errors: [...ADMIN_ERRORS, "not_found", "exists", "validation"],
  }),
  requireAdmin,
  validate.json(rejectInputSchema),
  async (c) =>
    c.json(
      await reject(c.get("actor"), {
        id: c.req.param("id"),
        reason: c.req.valid("json").reason,
      })
    )
)
