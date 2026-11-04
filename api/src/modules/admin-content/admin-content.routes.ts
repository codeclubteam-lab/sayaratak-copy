import { settingsSchema, sitePageSchema } from "@sayaratak/shared/schemas/admin"
import {
  pagePatchSchema,
  settingsPatchSchema,
} from "@sayaratak/shared/schemas/inputs"
import { Hono } from "hono"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireAdmin } from "~/modules/auth/auth.middleware"

import {
  changePage,
  changeSettings,
  getAdminPage,
  getSettings,
} from "./admin-content.service"

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const

export const adminContentRoutes = new Hono()

adminContentRoutes.get(
  "/admin/pages/:slug",
  spec({
    summary: "One of the four site pages (about, contact, privacy, terms)",
    access: "user",
    responses: { 200: sitePageSchema },
    errors: [...ADMIN_ERRORS, "not_found"],
  }),
  requireAdmin,
  async (c) => c.json(await getAdminPage(c.req.param("slug")))
)

adminContentRoutes.patch(
  "/admin/pages/:slug",
  spec({
    summary:
      "Change the title or body of a site page, in both languages; the page is stamped with the time even when nothing was sent",
    access: "user",
    responses: { 200: sitePageSchema },
    errors: [...ADMIN_ERRORS, "not_found", "validation"],
  }),
  requireAdmin,
  validate.json(pagePatchSchema),
  async (c) =>
    c.json(
      await changePage(c.get("actor"), {
        slug: c.req.param("slug"),
        edit: c.req.valid("json"),
      })
    )
)

adminContentRoutes.get(
  "/admin/settings",
  spec({
    summary:
      "Every site setting: listing rules, free limit, Bankak account, contact details, languages and backup schedule",
    access: "user",
    responses: { 200: settingsSchema },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getSettings())
)

adminContentRoutes.patch(
  "/admin/settings",
  spec({
    summary:
      "Change the settings sent; the bank account and the contact details are replaced as a whole. The free plan then shows the free listing limit",
    access: "user",
    responses: { 200: settingsSchema },
    errors: [...ADMIN_ERRORS, "validation"],
  }),
  requireAdmin,
  validate.json(settingsPatchSchema),
  async (c) => c.json(await changeSettings(c.get("actor"), c.req.valid("json")))
)
