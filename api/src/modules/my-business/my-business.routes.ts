import {
  dealershipSchema,
  mechanicSchema,
  workshopSchema,
} from "@sayaratak/shared/schemas/profile"
import {
  businessPatchSchema,
  idsInputSchema,
  imagesInputSchema,
} from "@sayaratak/shared/schemas/inputs"
import { Hono } from "hono"
import { z } from "zod"

import { validate } from "~/shared/http/validate"
import { spec } from "~/shared/openapi/registry"
import { requireRole } from "~/modules/auth/auth.middleware"

import { addMyImage, saveMyImages } from "./my-business.images.service"
import { getMyBusiness, updateMyBusiness } from "./my-business.service"

export const myBusinessRoutes = new Hono()

const mineSchema = z.union([dealershipSchema, workshopSchema, mechanicSchema])
const OWNER_ERRORS = [
  "unauthenticated",
  "banned",
  "forbidden",
  "not_found",
] as const

myBusinessRoutes.get(
  "/me/business",
  spec({
    summary:
      "The business profile of the signed-in dealership, workshop or mechanic",
    access: "user",
    responses: { 200: mineSchema },
    errors: [...OWNER_ERRORS],
  }),
  requireRole("dealership", "workshop", "mechanic"),
  async (c) => c.json(await getMyBusiness(c.get("user")))
)

myBusinessRoutes.patch(
  "/me/business",
  spec({
    summary:
      "Save the fields of the business profile the page sends; a section at a time",
    access: "user",
    responses: { 200: mineSchema },
    errors: [...OWNER_ERRORS, "validation"],
  }),
  requireRole("dealership", "workshop", "mechanic"),
  validate.json(businessPatchSchema),
  async (c) =>
    c.json(await updateMyBusiness(c.get("user"), c.req.valid("json")))
)

myBusinessRoutes.post(
  "/me/business/images",
  spec({
    summary: "Add one uploaded photo to the workshop's photos",
    access: "user",
    responses: { 200: workshopSchema },
    errors: [...OWNER_ERRORS, "validation", "limit_reached"],
    idempotent: true,
  }),
  requireRole("workshop"),
  validate.json(imagesInputSchema),
  async (c) => c.json(await addMyImage(c.get("user"), c.req.valid("json").url))
)

myBusinessRoutes.put(
  "/me/business/images",
  spec({
    summary: "Set the workshop's photos to these upload ids, in this order",
    access: "user",
    responses: { 200: workshopSchema },
    errors: [...OWNER_ERRORS, "validation", "limit_reached"],
  }),
  requireRole("workshop"),
  validate.json(idsInputSchema),
  async (c) =>
    c.json(await saveMyImages(c.get("user"), c.req.valid("json").ids))
)
