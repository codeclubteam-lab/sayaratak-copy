import { okSchema } from "@sayaratak/shared/schemas/api"
import { deviceInputSchema } from "@sayaratak/shared/schemas/inputs"
import { Hono } from "hono"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import { registerDevice, removeDevice } from "./devices.service"

export const devicesRoutes = new Hono()

const USER_ERRORS = ["unauthenticated", "banned"] as const

devicesRoutes.post(
  "/me/devices",
  spec({
    summary:
      "Register the app's push address; a token already registered moves to this account and is refreshed",
    access: "user",
    responses: { 200: okSchema },
    errors: [...USER_ERRORS, "validation"],
  }),
  requireUser,
  validate.json(deviceInputSchema),
  async (c) => {
    await registerDevice(c.get("user"), c.req.valid("json"))
    return c.json({ ok: true })
  }
)

devicesRoutes.delete(
  "/me/devices/:fcmToken",
  spec({
    summary:
      "Forget this account's device on sign-out (send the token URL-encoded); a token that is not the account's changes nothing",
    access: "user",
    responses: { 200: okSchema },
    errors: [...USER_ERRORS],
  }),
  requireUser,
  async (c) => {
    await removeDevice(c.get("user"), c.req.param("fcmToken"))
    return c.json({ ok: true })
  }
)
