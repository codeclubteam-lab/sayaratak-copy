import {
  promotionPriceSchema,
  promotionSchema,
} from "@sayaratak/shared/schemas/billing"
import { promotionInputSchema } from "@sayaratak/shared/schemas/inputs"
import { myPromotionsSchema } from "@sayaratak/shared/schemas/responses"
import { Hono } from "hono"
import { z } from "zod"

import { publicCache } from "~/shared/http/cache"
import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import { listMyPromotions } from "./promotions.mine.service"
import { listPromotionPrices, orderPromotion } from "./promotions.order.service"

export const promotionsRoutes = new Hono()

promotionsRoutes.get(
  "/promotion-prices",
  spec({
    summary: "The price of each Featured length and of a bump",
    access: "public",
    responses: { 200: z.array(promotionPriceSchema) },
  }),
  publicCache,
  async (c) => c.json(await listPromotionPrices())
)

promotionsRoutes.post(
  "/promotions",
  spec({
    summary:
      "Order a promotion for your own listing: `priceId` makes an unpaid order (asking again returns it), `useCredit` starts a 7-day Featured at once",
    access: "user",
    responses: { 200: promotionSchema },
    errors: [
      "unauthenticated",
      "banned",
      "forbidden",
      "not_found",
      "validation",
      "no_credits",
      "bump_wait",
    ],
    idempotent: true,
  }),
  requireUser,
  validate.json(promotionInputSchema),
  async (c) => c.json(await orderPromotion(c.get("user"), c.req.valid("json")))
)

promotionsRoutes.get(
  "/me/promotions",
  spec({
    summary:
      "The promotions of your listings with the listing, price and payment state: waiting ones first, then the newest start",
    access: "user",
    responses: { 200: myPromotionsSchema },
    errors: ["unauthenticated", "banned"],
  }),
  requireUser,
  async (c) => c.json(await listMyPromotions(c.get("user")))
)
