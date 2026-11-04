import { okSchema, rangeSchema } from "@sayaratak/shared/schemas/api"
import { listingAnalyticsSchema } from "@sayaratak/shared/schemas/api"
import { eventInputSchema } from "@sayaratak/shared/schemas/inputs"
import { analyticsSchema } from "@sayaratak/shared/schemas/responses"
import { Hono } from "hono"
import { z } from "zod"

import { rateLimit } from "~/shared/http/rate-limit"
import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import { getMyAnalytics } from "./analytics.me.service"
import { getListingAnalytics, recordEvent } from "./analytics.service"

// An unknown or missing `range` reads as 30 days, as the mock.
const rangeQuery = z.object({ range: rangeSchema })

export const analyticsRoutes = new Hono()

analyticsRoutes.post(
  "/events",
  spec({
    summary:
      "Count one view, call, WhatsApp tap, share or banner view or click; always answers ok, ids that match nothing are ignored",
    access: "public",
    responses: { 200: okSchema },
    errors: ["too_many_attempts"],
  }),
  rateLimit("events"),
  validate.json(eventInputSchema),
  async (c) => {
    await recordEvent(c.req.valid("json"))
    return c.json({ ok: true as const })
  }
)

analyticsRoutes.get(
  "/me/analytics",
  spec({
    summary:
      "Dashboard numbers for the last 7, 30 or 90 whole Khartoum days: a seller's listings, a business owner's profile, everything for an admin; `previous` is the period just before",
    access: "user",
    responses: { 200: analyticsSchema },
    errors: ["unauthenticated", "banned"],
  }),
  requireUser,
  validate.query(rangeQuery),
  async (c) => {
    const analytics = await getMyAnalytics(
      c.get("user"),
      c.req.valid("query").range
    )
    return c.json(analytics)
  }
)

analyticsRoutes.get(
  "/listings/:id/analytics",
  spec({
    summary:
      "One listing's views, calls, WhatsApp taps and shares per day and in total (owner or admin)",
    access: "user",
    responses: { 200: listingAnalyticsSchema },
    errors: ["unauthenticated", "banned", "forbidden", "not_found"],
  }),
  requireUser,
  validate.query(rangeQuery),
  async (c) => {
    const analytics = await getListingAnalytics(c.get("user"), {
      id: c.req.param("id"),
      range: c.req.valid("query").range,
    })
    return c.json(analytics)
  }
)
