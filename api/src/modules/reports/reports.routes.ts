import { reportSchema } from "@sayaratak/shared/schemas/admin"
import { reportInputSchema } from "@sayaratak/shared/schemas/inputs"
import { Hono } from "hono"

import { rateLimit } from "~/shared/http/rate-limit"
import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import { createReport } from "./reports.service"

export const reportsRoutes = new Hono()

reportsRoutes.post(
  "/reports",
  spec({
    summary: "Report a listing to the admin; the reason `other` needs details",
    access: "user",
    responses: { 200: reportSchema },
    errors: [
      "unauthenticated",
      "banned",
      "validation",
      "not_found",
      "too_many_attempts",
    ],
    idempotent: true,
  }),
  requireUser,
  rateLimit("reports"),
  validate.json(reportInputSchema),
  async (c) => c.json(await createReport(c.get("user"), c.req.valid("json")))
)
