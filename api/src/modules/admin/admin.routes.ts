import { rangeSchema } from "@sayaratak/shared/schemas/api"
import {
  activitySchema,
  adminSearchSchema,
  adminStatsSchema,
} from "@sayaratak/shared/schemas/responses"
import { Hono } from "hono"
import { z } from "zod"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireRole } from "~/modules/auth/auth.middleware"

import { getActivity } from "./admin.activity.service"
import { searchAdmin } from "./admin.search.service"
import { getStats } from "./admin.stats.service"

// An unknown or missing `range` reads as 30 days, as the mock.
const rangeQuery = z.object({ range: rangeSchema })

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const

export const adminRoutes = new Hono()

adminRoutes.get(
  "/admin/stats",
  spec({
    summary:
      "Dashboard totals and daily series for the last 7, 30 or 90 Khartoum days",
    access: "user",
    responses: { 200: adminStatsSchema },
    errors: [...ADMIN_ERRORS],
  }),
  requireRole("admin"),
  validate.query(rangeQuery),
  async (c) => c.json(await getStats(c.req.valid("query").range))
)

adminRoutes.get(
  "/admin/activity",
  spec({
    summary: "The ten newest listings, businesses, receipts and reports",
    access: "user",
    responses: { 200: activitySchema },
    errors: [...ADMIN_ERRORS],
  }),
  requireRole("admin"),
  async (c) => c.json(await getActivity())
)

adminRoutes.get(
  "/admin/search",
  spec({
    summary:
      "Up to five hits each for listings, accounts, businesses and payments; `q` is the text to find",
    access: "user",
    responses: { 200: adminSearchSchema },
    errors: [...ADMIN_ERRORS],
  }),
  requireRole("admin"),
  async (c) => c.json(await searchAdmin(c.req.query("q")))
)
