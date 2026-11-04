import { adminBusinessSchema } from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  assignPlanInputSchema,
  businessAdminPatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import { Hono } from "hono"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireAdmin } from "~/modules/auth/auth.middleware"

import {
  assignPlan,
  getAdminBusinesses,
  updateBusiness,
} from "./admin-businesses.service"

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const

export const adminBusinessesRoutes = new Hono()

adminBusinessesRoutes.get(
  "/admin/businesses",
  spec({
    summary:
      "Dealerships, workshops and mechanics newest first, each with its owner, plan and rating; filters `type`, `id`, `cityId`, `verified` (yes, no), `status`, `planId` and `q` (name or owner), paged",
    access: "user",
    responses: { 200: pageOf(adminBusinessSchema) },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getAdminBusinesses(c.req.query()))
)

adminBusinessesRoutes.patch(
  "/admin/businesses/:id",
  spec({
    summary:
      "Set the verified badge and the suspension of a business; suspending needs a `reason`; the owner is told when the badge is taken away, when the page is suspended and when it is back",
    access: "user",
    responses: { 200: adminBusinessSchema },
    errors: [...ADMIN_ERRORS, "not_found", "validation"],
  }),
  requireAdmin,
  validate.json(businessAdminPatchSchema),
  async (c) =>
    c.json(
      await updateBusiness(c.get("actor"), {
        id: c.req.param("id"),
        patch: c.req.valid("json"),
      })
    )
)

adminBusinessesRoutes.post(
  "/admin/businesses/:id/assign-plan",
  spec({
    summary:
      "Give a business a plan now, replacing its active subscription; price, listing limit (dealerships only) and length left out take the plan's own",
    access: "user",
    responses: { 200: adminBusinessSchema },
    errors: [...ADMIN_ERRORS, "not_found", "validation"],
  }),
  requireAdmin,
  validate.json(assignPlanInputSchema),
  async (c) =>
    c.json(
      await assignPlan(c.get("actor"), {
        id: c.req.param("id"),
        input: c.req.valid("json"),
      })
    )
)
