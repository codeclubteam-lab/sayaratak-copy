import {
  adminCampaignSchema,
  adPageSchema,
  campaignSchema,
} from "@sayaratak/shared/schemas/ads"
import {
  adPagePatchSchema,
  rejectInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import { Hono } from "hono"
import { z } from "zod"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireAdmin } from "~/modules/auth/auth.middleware"

import {
  approveCampaign,
  changeAdPage,
  getAdPages,
  getCampaigns,
  rejectCampaign,
} from "./admin-ads.service"

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const

export const adminAdsRoutes = new Hono()

adminAdsRoutes.get(
  "/admin/campaigns",
  spec({
    summary:
      "Every banner campaign with the receipt it was paid with; the ones waiting for review first, then newest first",
    access: "user",
    responses: { 200: z.array(adminCampaignSchema) },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getCampaigns())
)

adminAdsRoutes.post(
  "/admin/campaigns/:id/approve",
  spec({
    summary:
      "Approve a campaign waiting for review together with the receipt sent for it, and tell the advertiser. Any other state answers 409 `exists`",
    access: "user",
    responses: { 200: campaignSchema },
    errors: [...ADMIN_ERRORS, "not_found", "exists"],
  }),
  requireAdmin,
  async (c) => c.json(await approveCampaign(c.get("actor"), c.req.param("id")))
)

adminAdsRoutes.post(
  "/admin/campaigns/:id/reject",
  spec({
    summary:
      "Reject a campaign waiting for review and its receipt with a reason, and tell the advertiser. Any other state answers 409 `exists`",
    access: "user",
    responses: { 200: campaignSchema },
    errors: [...ADMIN_ERRORS, "not_found", "exists", "validation"],
  }),
  requireAdmin,
  validate.json(rejectInputSchema),
  async (c) =>
    c.json(
      await rejectCampaign(c.get("actor"), {
        id: c.req.param("id"),
        reason: c.req.valid("json").reason,
      })
    )
)

adminAdsRoutes.get(
  "/admin/ad-pages",
  spec({
    summary:
      "Every page that sells banner space, switched off ones too, with its weekly price and slots; `free` is every slot",
    access: "user",
    responses: { 200: z.array(adPageSchema) },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getAdPages())
)

adminAdsRoutes.patch(
  "/admin/ad-pages/:id",
  spec({
    summary:
      "Change the weekly price, slots or sale switch of a page. Campaigns already booked keep their slot",
    access: "user",
    responses: { 200: adPageSchema },
    errors: [...ADMIN_ERRORS, "not_found", "validation"],
  }),
  requireAdmin,
  validate.json(adPagePatchSchema),
  async (c) =>
    c.json(
      await changeAdPage(c.get("actor"), {
        id: c.req.param("id"),
        edit: c.req.valid("json"),
      })
    )
)
