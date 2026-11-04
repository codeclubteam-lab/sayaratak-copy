import { bannerSchema } from "@sayaratak/shared/schemas/admin"
import { okSchema } from "@sayaratak/shared/schemas/api"
import { bannerInputSchema } from "@sayaratak/shared/schemas/inputs"
import { Hono } from "hono"
import { z } from "zod"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireAdmin } from "~/modules/auth/auth.middleware"

import {
  addBanner,
  changeBanner,
  getBanners,
  removeBanner,
} from "./admin-banners.service"

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const

export const adminBannersRoutes = new Hono()

adminBannersRoutes.get(
  "/admin/banners",
  spec({
    summary:
      "Every house banner by sort order, the ones that are off or have ended too, with views and clicks",
    access: "user",
    responses: { 200: z.array(bannerSchema) },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getBanners())
)

adminBannersRoutes.post(
  "/admin/banners",
  spec({
    summary:
      "Add a banner. Each language's picture is an image the admin uploaded with `POST /uploads` (422 on `imageUrl.ar` or `imageUrl.en` otherwise); the end date must be after the start",
    access: "user",
    responses: { 200: bannerSchema },
    errors: [...ADMIN_ERRORS, "validation"],
  }),
  requireAdmin,
  validate.json(bannerInputSchema),
  async (c) => c.json(await addBanner(c.get("actor"), c.req.valid("json")))
)

adminBannersRoutes.patch(
  "/admin/banners/:id",
  spec({
    summary:
      "Change the fields sent of a banner. A picture sent with its current address stays; a new one must be an upload of the admin's, and the old one is deleted",
    access: "user",
    responses: { 200: bannerSchema },
    errors: [...ADMIN_ERRORS, "not_found", "validation"],
  }),
  requireAdmin,
  validate.json(bannerInputSchema.partial()),
  async (c) =>
    c.json(
      await changeBanner(c.get("actor"), {
        id: c.req.param("id"),
        edit: c.req.valid("json"),
      })
    )
)

adminBannersRoutes.delete(
  "/admin/banners/:id",
  spec({
    summary: "Delete a banner and its pictures",
    access: "user",
    responses: { 200: okSchema },
    errors: [...ADMIN_ERRORS, "not_found"],
  }),
  requireAdmin,
  async (c) => {
    await removeBanner(c.get("actor"), c.req.param("id"))
    return c.json({ ok: true as const })
  }
)
