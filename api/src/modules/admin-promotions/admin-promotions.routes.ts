import { promotionPriceSchema } from "@sayaratak/shared/schemas/billing"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { grantInputSchema } from "@sayaratak/shared/schemas/inputs"
import { myPromotionSchema } from "@sayaratak/shared/schemas/responses"
import { Hono } from "hono"
import { z } from "zod"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireAdmin } from "~/modules/auth/auth.middleware"

import {
  end,
  getAdminPrices,
  getAdminPromotions,
  grant,
  updatePrice,
} from "./admin-promotions.service"

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const
// What the price form allows: a price from 0, a length of 1 to 90 days.
const priceEditSchema = z
  .object({
    price: z.number().int().min(0).max(9_999_999_999),
    durationDays: z.number().int().min(1).max(90),
  })
  .partial()

export const adminPromotionsRoutes = new Hono()

adminPromotionsRoutes.get(
  "/admin/promotion-prices",
  spec({
    summary: "The price rows: Featured by length, then the bump",
    access: "user",
    responses: { 200: z.array(promotionPriceSchema) },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getAdminPrices())
)

adminPromotionsRoutes.patch(
  "/admin/promotion-prices/:id",
  spec({
    summary:
      "Change a price and, for a Featured, its length; the set of rows is fixed and a bump has no length. 409 `conflict` when another row already has that length",
    access: "user",
    responses: { 200: promotionPriceSchema },
    errors: [...ADMIN_ERRORS, "not_found", "conflict", "validation"],
  }),
  requireAdmin,
  validate.json(priceEditSchema),
  async (c) =>
    c.json(
      await updatePrice(c.get("actor"), {
        id: c.req.param("id"),
        edit: c.req.valid("json"),
      })
    )
)

adminPromotionsRoutes.get(
  "/admin/promotions",
  spec({
    summary:
      "Promotions with their listing, price and receipt state, waiting ones first then the newest start; filters `status` and `q` (listing title), paged",
    access: "user",
    responses: { 200: pageOf(myPromotionSchema) },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getAdminPromotions(c.req.query()))
)

adminPromotionsRoutes.post(
  "/admin/promotions/grant",
  spec({
    summary:
      "Give a listing a free promotion that starts now: a Featured for `days`, or a bump",
    access: "user",
    responses: { 200: myPromotionSchema },
    errors: [...ADMIN_ERRORS, "not_found", "validation"],
  }),
  requireAdmin,
  validate.json(grantInputSchema),
  async (c) => c.json(await grant(c.get("actor"), c.req.valid("json")))
)

adminPromotionsRoutes.post(
  "/admin/promotions/:id/end",
  spec({
    summary:
      "End a running promotion now; it leaves its listing at once. 409 `conflict` when it is not running",
    access: "user",
    responses: { 200: myPromotionSchema },
    errors: [...ADMIN_ERRORS, "not_found", "conflict"],
  }),
  requireAdmin,
  async (c) => c.json(await end(c.get("actor"), c.req.param("id")))
)
