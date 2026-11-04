import { broadcastSchema } from "@sayaratak/shared/schemas/api"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  broadcastEstimateQuerySchema,
  broadcastInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import { estimateSchema } from "@sayaratak/shared/schemas/responses"
import { Hono } from "hono"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireAdmin } from "~/modules/auth/auth.middleware"

import {
  getBroadcasts,
  getEstimate,
  sendBroadcast,
} from "./admin-broadcasts.service"

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const

export const adminBroadcastsRoutes = new Hono()

adminBroadcastsRoutes.get(
  "/admin/broadcasts",
  spec({
    summary:
      "The announcements sent so far, newest first, with their `status` and how many accounts each has reached; `q` keeps those whose title holds it in either language, paged",
    access: "user",
    responses: { 200: pageOf(broadcastSchema) },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getBroadcasts(c.req.query()))
)

adminBroadcastsRoutes.get(
  "/admin/broadcasts/estimate",
  spec({
    summary:
      "How many accounts an announcement would reach: `roles` (repeat the key), optional `cityId`, `verifiedOnly`. Only accounts that read announcements count",
    access: "user",
    responses: { 200: estimateSchema },
    errors: [...ADMIN_ERRORS, "validation"],
  }),
  requireAdmin,
  validate.query(broadcastEstimateQuerySchema, ["roles"]),
  async (c) => c.json(await getEstimate(c.req.valid("query")))
)

adminBroadcastsRoutes.post(
  "/admin/broadcasts",
  spec({
    summary:
      "Queue an announcement for every account in the audience that reads announcements and keep it in the history. It answers at once with `status` queued and 0 recipients; a background job rings the bells in chunks (`sending`, then `sent`) and `recipients` counts those reached so far, so poll `GET /admin/broadcasts` for progress. Only accounts that existed when it was sent are reached. 422 on `cityId` for an unknown city",
    access: "user",
    responses: { 200: broadcastSchema },
    errors: [...ADMIN_ERRORS, "validation"],
  }),
  requireAdmin,
  validate.json(broadcastInputSchema),
  async (c) => c.json(await sendBroadcast(c.get("actor"), c.req.valid("json")))
)
