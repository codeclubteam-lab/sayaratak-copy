import { countsSchema, okSchema } from "@sayaratak/shared/schemas/api"
import { pageOf } from "@sayaratak/shared/schemas/fields"
import { readInputSchema } from "@sayaratak/shared/schemas/inputs"
import { notificationSchema } from "@sayaratak/shared/schemas/messaging"
import { Hono } from "hono"

import { pageParams } from "~/shared/http/page"
import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import { getCounts } from "./notifications.counts.service"
import {
  listNotifications,
  markNotificationsRead,
} from "./notifications.service"

export const notificationsRoutes = new Hono()

const PAGE_SIZE = { default: 20, max: 100 }
const USER_ERRORS = ["unauthenticated", "banned"] as const

notificationsRoutes.get(
  "/notifications",
  spec({
    summary:
      "The account's notifications, newest first. `unread=true` keeps the unread ones; `before=<id>` with `limit` lists the ones older than that notification",
    access: "user",
    responses: { 200: pageOf(notificationSchema) },
    errors: [...USER_ERRORS],
  }),
  requireUser,
  async (c) => {
    const query = c.req.query()
    return c.json(
      await listNotifications(c.get("user"), {
        unreadOnly: query.unread === "true",
        before: query.before || undefined,
        page: pageParams(query, PAGE_SIZE),
      })
    )
  }
)

notificationsRoutes.post(
  "/notifications/read",
  spec({
    summary:
      "Mark the notifications named in `ids` read, or all when none are named",
    access: "user",
    responses: { 200: okSchema },
    errors: [...USER_ERRORS, "validation"],
  }),
  requireUser,
  validate.json(readInputSchema),
  async (c) => {
    await markNotificationsRead(c.get("user"), c.req.valid("json").ids)
    return c.json({ ok: true })
  }
)

notificationsRoutes.get(
  "/me/counts",
  spec({
    summary:
      "Unread messages and notifications; admin queue sizes for an admin",
    access: "user",
    responses: { 200: countsSchema },
    errors: [...USER_ERRORS],
  }),
  requireUser,
  async (c) => c.json(await getCounts(c.get("user")))
)
