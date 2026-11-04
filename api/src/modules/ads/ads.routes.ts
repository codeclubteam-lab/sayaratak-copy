import { bannerSchema } from "@sayaratak/shared/schemas/admin"
import {
  adPageSchema,
  adTargetSchema,
  campaignSchema,
} from "@sayaratak/shared/schemas/ads"
import { campaignInputSchema } from "@sayaratak/shared/schemas/inputs"
import { Hono } from "hono"
import { z } from "zod"

import { db } from "~/shared/db/client"
import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireRole, requireUser } from "~/modules/auth/auth.middleware"

import { createCampaign, listMyCampaigns } from "./ads.campaigns.service"
import { listAdPages } from "./ads.pages.service"
import { listLiveBanners } from "./ads.banners.service"
import { serveAds } from "./ads.serve.service"
import { listAdTargets } from "./ads.targets.service"

export const adsRoutes = new Hono()

adsRoutes.get(
  "/ad-pages",
  spec({
    summary:
      "The pages on sale with price and slots; `startDate` (YYYY-MM-DD) with `weeks` (1 to 4) makes `free` count that period",
    access: "user",
    responses: { 200: z.array(adPageSchema) },
    errors: ["unauthenticated", "banned"],
  }),
  requireUser,
  async (c) =>
    c.json(
      await listAdPages({
        startDate: c.req.query("startDate"),
        weeks: c.req.query("weeks"),
      })
    )
)

adsRoutes.get(
  "/me/ad-targets",
  spec({
    summary:
      "Where a banner may link: the advertiser's public profile, then up to 50 public listings",
    access: "user",
    responses: { 200: z.array(adTargetSchema) },
    errors: ["unauthenticated", "banned", "forbidden"],
  }),
  requireRole("dealership", "workshop", "mechanic"),
  async (c) => c.json(await listAdTargets(db, c.get("user")))
)

adsRoutes.get(
  "/me/campaigns",
  spec({
    summary: "The account's banner campaigns, newest first",
    access: "user",
    responses: { 200: z.array(campaignSchema) },
    errors: ["unauthenticated", "banned"],
  }),
  requireUser,
  async (c) => c.json(await listMyCampaigns(c.get("user")))
)

adsRoutes.post(
  "/campaigns",
  spec({
    summary:
      "Book a banner: priced from the pages' weekly prices times the weeks, unpaid until its receipt is sent",
    access: "user",
    responses: { 200: campaignSchema },
    errors: [
      "unauthenticated",
      "banned",
      "forbidden",
      "validation",
      "page_full",
    ],
    idempotent: true,
  }),
  requireRole("dealership", "workshop", "mechanic"),
  validate.json(campaignInputSchema),
  async (c) => c.json(await createCampaign(c.get("user"), c.req.valid("json")))
)

adsRoutes.get(
  "/ads",
  spec({
    summary:
      "The paid banner of a page (`page`): one running campaign picked at random, or none",
    access: "public",
    responses: { 200: z.array(bannerSchema) },
  }),
  async (c) => c.json(await serveAds(c.req.query("page")))
)

adsRoutes.get(
  "/banners",
  spec({
    summary:
      "The house banners live now, in sort order; `placement` narrows them to one place (an unknown one gives none)",
    access: "public",
    responses: { 200: z.array(bannerSchema) },
  }),
  async (c) => c.json(await listLiveBanners(c.req.query("placement")))
)
