import { adminReportSchema } from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import {
  noteInputSchema,
  reportActionInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import { Hono } from "hono"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireAdmin } from "~/modules/auth/auth.middleware"

import { act, dismiss, getAdminReports } from "./admin-reports.service"

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const

export const adminReportsRoutes = new Hono()

adminReportsRoutes.get(
  "/admin/reports",
  spec({
    summary:
      "Reports newest first, each with its listing, reporter and whether the seller is banned; filters `status` (open, dismissed, actioned, resolved), `id` and `q` (listing title, reporter name), paged",
    access: "user",
    responses: { 200: pageOf(adminReportSchema) },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getAdminReports(c.get("actor"), c.req.query()))
)

adminReportsRoutes.post(
  "/admin/reports/:id/dismiss",
  spec({
    summary:
      "Close an open report as dismissed, with a note. A report already closed answers 409 `conflict`",
    access: "user",
    responses: { 200: adminReportSchema },
    errors: [...ADMIN_ERRORS, "not_found", "conflict", "validation"],
  }),
  requireAdmin,
  validate.json(noteInputSchema),
  async (c) =>
    c.json(
      await dismiss(c.get("actor"), {
        id: c.req.param("id"),
        note: c.req.valid("json").note,
      })
    )
)

adminReportsRoutes.post(
  "/admin/reports/:id/action",
  spec({
    summary:
      "Act on an open report: remove the listing and tell its owner, or with `ban` ban the seller and tell nobody. Every open report on the listing closes with the note. A listing that cannot be removed only has its reports closed; a report already closed answers 409 `conflict`",
    access: "user",
    responses: { 200: adminReportSchema },
    errors: [...ADMIN_ERRORS, "not_found", "conflict", "validation"],
  }),
  requireAdmin,
  validate.json(reportActionInputSchema),
  async (c) =>
    c.json(
      await act(c.get("actor"), {
        id: c.req.param("id"),
        input: c.req.valid("json"),
        headers: c.req.raw.headers,
      })
    )
)
