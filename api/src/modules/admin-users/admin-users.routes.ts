import { adminUserSchema } from "@sayaratak/shared/schemas/admin"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { banInputSchema } from "@sayaratak/shared/schemas/inputs"
import { userSchema } from "@sayaratak/shared/schemas/user"
import { Hono } from "hono"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireAdmin } from "~/modules/auth/auth.middleware"

import { banAccount, getAdminUsers, unbanAccount } from "./admin-users.service"

const ADMIN_ERRORS = ["unauthenticated", "banned", "forbidden"] as const

export const adminUsersRoutes = new Hono()

adminUsersRoutes.get(
  "/admin/users",
  spec({
    summary:
      "Accounts newest first, each with its listings and the reports on them; filters `role`, `status` (active, banned), `id` and `q` (name, phone, email), paged",
    access: "user",
    responses: { 200: pageOf(adminUserSchema) },
    errors: [...ADMIN_ERRORS],
  }),
  requireAdmin,
  async (c) => c.json(await getAdminUsers(c.req.query()))
)

adminUsersRoutes.post(
  "/admin/users/:id/ban",
  spec({
    summary:
      "Ban an account for 7 days, 30 days or for good, with a reason; ends its sessions. An admin cannot be banned",
    access: "user",
    responses: { 200: userSchema },
    errors: [...ADMIN_ERRORS, "not_found", "validation"],
  }),
  requireAdmin,
  validate.json(banInputSchema),
  async (c) =>
    c.json(
      await banAccount(c.get("actor"), {
        userId: c.req.param("id"),
        input: c.req.valid("json"),
        headers: c.req.raw.headers,
      })
    )
)

adminUsersRoutes.post(
  "/admin/users/:id/unban",
  spec({
    summary: "Lift a ban; an account that is not banned is returned as it is",
    access: "user",
    responses: { 200: userSchema },
    errors: [...ADMIN_ERRORS, "not_found"],
  }),
  requireAdmin,
  async (c) =>
    c.json(
      await unbanAccount(c.get("actor"), {
        userId: c.req.param("id"),
        headers: c.req.raw.headers,
      })
    )
)
