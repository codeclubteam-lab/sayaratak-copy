import { draftSchema } from "@sayaratak/shared/schemas/api"
import { draftInputSchema } from "@sayaratak/shared/schemas/inputs"
import { Hono } from "hono"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireUser } from "~/modules/auth/auth.middleware"

import { getDraft, saveDraft } from "./account.service"

export const accountRoutes = new Hono()

accountRoutes.get(
  "/drafts/:key",
  spec({
    summary: "A form saved half way, or empty data",
    access: "user",
    responses: { 200: draftSchema },
    errors: ["unauthenticated", "banned"],
  }),
  requireUser,
  async (c) => {
    const draft = await getDraft(c.get("user"), c.req.param("key"))
    return c.json(draft)
  }
)

accountRoutes.patch(
  "/drafts/:key",
  spec({
    summary: "Save a form half way",
    access: "user",
    responses: { 200: draftSchema },
    errors: ["unauthenticated", "banned", "validation"],
  }),
  requireUser,
  validate.json(draftInputSchema),
  async (c) => {
    const { data } = c.req.valid("json")
    const draft = await saveDraft(c.get("user"), {
      key: c.req.param("key"),
      data,
    })
    return c.json(draft)
  }
)
