import { okSchema } from "@sayaratak/shared/schemas/api"
import {
  adminPlanSchema,
  adminSubscriptionSchema,
} from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { planInputSchema } from "@sayaratak/shared/schemas/inputs"
import { Hono } from "hono"
import { z } from "zod"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireAdmin } from "~/modules/auth/auth.middleware"

import {
  createPlan,
  deletePlan,
  getAdminPlans,
  getAdminSubscriptions,
  updatePlan,
} from "./admin-plans.service"

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const
const planEditSchema = planInputSchema.omit({ audience: true }).partial()

export const adminPlansRoutes = new Hono()

adminPlansRoutes.get(
  "/admin/plans",
  spec({
    summary:
      "Every plan in list order, the disabled ones too, with `free` (the audience's free plan), `inUse` (a subscription or receipt names it) and `subscribers` (active now)",
    access: "user",
    responses: { 200: z.array(adminPlanSchema) },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getAdminPlans())
)

adminPlansRoutes.post(
  "/admin/plans",
  spec({
    summary:
      "Add a plan; a cap sent as `null` means no cap. The individuals' free plan always shows the free-listing setting as its limit",
    access: "user",
    responses: { 200: adminPlanSchema },
    errors: [...ADMIN_ERRORS, "validation"],
  }),
  requireAdmin,
  validate.json(planInputSchema),
  async (c) => c.json(await createPlan(c.get("actor"), c.req.valid("json")))
)

adminPlansRoutes.patch(
  "/admin/plans/:id",
  spec({
    summary:
      "Change a plan; the audience never changes, a cap sent as `null` is taken off. The free plan of an audience keeps its price of 0 and stays on (409 `in_use`)",
    access: "user",
    responses: { 200: adminPlanSchema },
    errors: [...ADMIN_ERRORS, "not_found", "in_use", "validation"],
  }),
  requireAdmin,
  validate.json(planEditSchema),
  async (c) =>
    c.json(
      await updatePlan(c.get("actor"), {
        id: c.req.param("id"),
        edit: c.req.valid("json"),
      })
    )
)

adminPlansRoutes.delete(
  "/admin/plans/:id",
  spec({
    summary:
      "Delete a plan; refused (409 `in_use`) while a subscription or receipt names it and for the free plan of an audience",
    access: "user",
    responses: { 200: okSchema },
    errors: [...ADMIN_ERRORS, "not_found", "in_use"],
  }),
  requireAdmin,
  async (c) => {
    await deletePlan(c.get("actor"), c.req.param("id"))
    return c.json({ ok: true as const })
  }
)

adminPlansRoutes.get(
  "/admin/subscriptions",
  spec({
    summary:
      "Every subscription newest first with its plan and holder (the business, else the person); filters `audience`, `planId`, `status` and `q` (holder name), paged",
    access: "user",
    responses: { 200: pageOf(adminSubscriptionSchema) },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getAdminSubscriptions(c.req.query()))
)
