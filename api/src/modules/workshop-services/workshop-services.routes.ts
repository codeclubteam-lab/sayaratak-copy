import { okSchema } from "@sayaratak/shared/schemas/api"
import {
  idsInputSchema,
  serviceInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import { workshopSchema } from "@sayaratak/shared/schemas/profile"
import { Hono } from "hono"
import { z } from "zod"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireRole } from "~/modules/auth/auth.middleware"

import {
  addMyService,
  deleteMyService,
  getMyServices,
  reorderMyServices,
  updateMyService,
} from "./workshop-services.service"

export const workshopServicesRoutes = new Hono()

const serviceSchema = workshopSchema.shape.services.element
const listSchema = workshopSchema.shape.services
// A save sends only the fields it changes, and a missing `templateId` must not clear the link to its template.
const patchSchema = serviceInputSchema
  .partial()
  .extend({ templateId: z.string().nullable().optional() })
const OWNER_ERRORS = [
  "unauthenticated",
  "banned",
  "forbidden",
  "not_found",
] as const

workshopServicesRoutes.get(
  "/me/services",
  spec({
    summary: "The signed-in workshop's services in its order",
    access: "user",
    responses: { 200: listSchema },
    errors: [...OWNER_ERRORS],
  }),
  requireRole("workshop"),
  async (c) => c.json(await getMyServices(c.get("user")))
)

workshopServicesRoutes.post(
  "/me/services",
  spec({
    summary:
      "Add a service at the end; past the plan's service limit it is 403 limit_reached",
    access: "user",
    responses: { 200: serviceSchema },
    errors: [...OWNER_ERRORS, "validation", "limit_reached"],
    idempotent: true,
  }),
  requireRole("workshop"),
  validate.json(serviceInputSchema),
  async (c) => {
    const input = c.req.valid("json")
    return c.json(
      await addMyService(c.get("user"), {
        ...input,
        description: input.description ?? "",
        priceFrom: input.priceFrom ?? null,
      })
    )
  }
)

// Registered before `/:id` so the word "reorder" is never read as an id.
workshopServicesRoutes.post(
  "/me/services/reorder",
  spec({
    summary:
      "Put the named services first in this order; the others follow, none is deleted",
    access: "user",
    responses: { 200: listSchema },
    errors: [...OWNER_ERRORS, "validation"],
  }),
  requireRole("workshop"),
  validate.json(idsInputSchema),
  async (c) =>
    c.json(await reorderMyServices(c.get("user"), c.req.valid("json").ids))
)

workshopServicesRoutes.patch(
  "/me/services/:id",
  spec({
    summary: "Change the fields sent of one service",
    access: "user",
    responses: { 200: serviceSchema },
    errors: [...OWNER_ERRORS, "validation"],
  }),
  requireRole("workshop"),
  validate.json(patchSchema),
  async (c) =>
    c.json(
      await updateMyService(c.get("user"), {
        id: c.req.param("id"),
        change: c.req.valid("json"),
      })
    )
)

workshopServicesRoutes.delete(
  "/me/services/:id",
  spec({
    summary: "Remove one service",
    access: "user",
    responses: { 200: okSchema },
    errors: [...OWNER_ERRORS],
  }),
  requireRole("workshop"),
  async (c) => {
    await deleteMyService(c.get("user"), c.req.param("id"))
    return c.json({ ok: true })
  }
)
